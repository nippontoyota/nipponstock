import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { getBlockingDays } from '../services/modelDuration';
import { logAudit } from '../services/audit';
import { emitHeatmapUpdate, emitBlockingUpdate } from '../services/events';

const router = Router();
router.use(authenticate);

// POST /blocking/soft — atomic soft block
router.post('/soft', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({
    model: z.string().min(1),
    suffix: z.string().min(1),
    colour: z.string().min(1),
    chassisYear: z.number().int().optional(),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { model, suffix, colour, chassisYear } = parsed.data;
  const userId = req.user!.userId;
  const branchId = req.user!.branchId;

  if (!branchId) { res.status(403).json({ error: 'Only sales managers can place blocks' }); return; }

  // Atomic: find an OPEN vehicle and soft-block it in a single transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      const baseWhere: Record<string, unknown> = { model, suffix, colour, status: 'OPEN', hiddenFromHeatmap: false };
      if (chassisYear) baseWhere.chassisYear = chassisYear;

      // Priority: BND → CTDMS → MDDP → any (no stockStatus set)
      let vehicle = await tx.vehicle.findFirst({ where: { ...baseWhere, stockStatus: 'BND' }, select: { id: true, model: true, stockStatus: true } });
      if (!vehicle) vehicle = await tx.vehicle.findFirst({ where: { ...baseWhere, stockStatus: 'CTDMS' }, select: { id: true, model: true, stockStatus: true } });
      if (!vehicle) vehicle = await tx.vehicle.findFirst({ where: { ...baseWhere, stockStatus: 'MDDP' }, select: { id: true, model: true, stockStatus: true } });
      if (!vehicle) vehicle = await tx.vehicle.findFirst({ where: baseWhere, select: { id: true, model: true, stockStatus: true } });

      if (!vehicle) throw new Error('NO_VEHICLE');

      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { status: 'SOFT_BLOCKED' },
      });

      const blocking = await tx.blockingRequest.create({
        data: {
          vehicleId: vehicle.id,
          userId,
          branchId,
          blockType: 'SOFT',
          softBlockAt: new Date(),
          expiryAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      return blocking;
    });

    emitHeatmapUpdate();
    res.status(201).json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'NO_VEHICLE') {
      res.status(409).json({ error: 'This vehicle was just taken — please select again' });
    } else {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// POST /blocking/hard — convert soft to hard block
router.post('/hard', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({
    blockingId: z.string().uuid(),
    chassisYear: z.number().int(),
    orderId: z.string().min(1),
    customerName: z.string().min(1),
    consultantName: z.string().min(1),
    paymentMode: z.enum(['CASH', 'FINANCE']),
    amountReceived: z.number().optional(),
    financierBank: z.string().optional(),
    paymentStatus: z.string().min(1),
    expectedBillingDate: z.string().datetime(),
  });

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { blockingId, chassisYear, ...formData } = parsed.data;
  const userId = req.user!.userId;

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: blockingId },
    include: { vehicle: true },
  });

  if (!existing || existing.userId !== userId || existing.blockType !== 'SOFT' || existing.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Soft block not found or already expired' });
    return;
  }

  // Check soft block still valid (5 min)
  if (existing.expiryAt && existing.expiryAt < new Date()) {
    res.status(409).json({ error: 'Soft block has expired — please start again' });
    return;
  }

  const days = await getBlockingDays(existing.vehicle.model, existing.vehicle.stockStatus);
  const expiryAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: existing.vehicleId },
        data: { chassisYear, status: 'HARD_BLOCKED' },
      });

      return tx.blockingRequest.update({
        where: { id: blockingId },
        data: {
          blockType: 'HARD',
          hardBlockAt: new Date(),
          expiryAt,
          ...formData,
          expectedBillingDate: new Date(formData.expectedBillingDate),
        },
        include: { vehicle: true, branch: true },
      });
    });

    await logAudit({
      entityType: 'BLOCKING',
      entityId: blockingId,
      action: 'HARD_BLOCKED',
      performedById: userId,
      newValue: { status: 'HARD_BLOCKED', expiryAt },
    });

    emitHeatmapUpdate();
    emitBlockingUpdate(blockingId);
    res.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: 'Failed to confirm block', detail: msg });
  }
});

// GET /blocking/my
router.get('/my', async (req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    include: { vehicle: true, branch: { select: { name: true } } },
  });
  res.json(blockings);
});

// GET /blocking/all — admin
router.get('/all', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { branchId, status, model, search, from, to, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (model) where.vehicle = { model: { contains: model, mode: 'insensitive' } };
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { orderId: { contains: search, mode: 'insensitive' } },
      { vehicle: { chassisNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [blockings, total] = await Promise.all([
    prisma.blockingRequest.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: true,
        user: { select: { fullName: true, loginId: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.blockingRequest.count({ where }),
  ]);
  res.json({ blockings, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /blocking/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const blocking = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { vehicle: true, user: { select: { fullName: true, loginId: true } }, branch: true },
  });
  if (!blocking) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = blocking.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  if (!isOwner && !isAdmin) { res.status(403).json({ error: 'Forbidden' }); return; }

  res.json(blocking);
});

// PATCH /blocking/:id — admin edit
router.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.blockingRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const EditSchema = z.object({
    customerName: z.string().optional(),
    consultantName: z.string().optional(),
    paymentMode: z.enum(['CASH', 'FINANCE']).optional(),
    financierBank: z.string().optional(),
    paymentStatus: z.string().optional(),
    expectedBillingDate: z.string().datetime().optional(),
    adminNotes: z.string().optional(),
  });

  const parsed = EditSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.expectedBillingDate) data.expectedBillingDate = new Date(parsed.data.expectedBillingDate);

  const updated = await prisma.blockingRequest.update({ where: { id: req.params.id }, data });
  await logAudit({ entityType: 'BLOCKING', entityId: req.params.id, action: 'EDITED', performedById: req.user!.userId, previousValue: existing, newValue: updated });

  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

// PATCH /blocking/:id/extend
router.patch('/:id/extend', requireAdmin, async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ expiryAt: z.string().datetime() });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await prisma.blockingRequest.update({
    where: { id: req.params.id },
    data: { expiryAt: new Date(parsed.data.expiryAt), extendedByAdmin: true },
  });

  await logAudit({ entityType: 'BLOCKING', entityId: req.params.id, action: 'EXTENDED', performedById: req.user!.userId, previousValue: { expiryAt: existing.expiryAt }, newValue: { expiryAt: updated.expiryAt } });

  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

// PATCH /blocking/:id/release — admin manual release
router.patch('/:id/release', requireAdmin, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.blockingRequest.findUnique({ where: { id: req.params.id }, include: { vehicle: true } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  await prisma.$transaction([
    prisma.blockingRequest.update({ where: { id: req.params.id }, data: { status: 'EXPIRED' } }),
    prisma.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'OPEN' } }),
  ]);

  await logAudit({ entityType: 'BLOCKING', entityId: req.params.id, action: 'RELEASED', performedById: req.user!.userId, previousValue: { status: existing.status }, newValue: { status: 'EXPIRED' } });

  emitHeatmapUpdate();
  emitBlockingUpdate(req.params.id);
  res.json({ ok: true });
});

// PATCH /blocking/:id/self-release — owner releases their own booking back to open pool
router.patch('/:id/self-release', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({
    reason: z.string().min(1),
    salesId: z.string().min(1),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({ where: { id: req.params.id }, include: { vehicle: true } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  if (!isOwner && !isAdmin) { res.status(403).json({ error: 'Forbidden' }); return; }

  if (existing.status !== 'ACTIVE') {
    res.status(409).json({ error: 'Booking is not active' });
    return;
  }

  await prisma.$transaction([
    prisma.blockingRequest.update({
      where: { id: req.params.id },
      data: { status: 'EXPIRED', adminNotes: `Released by sales. Reason: ${parsed.data.reason} | Sales ID: ${parsed.data.salesId}` },
    }),
    prisma.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'OPEN' } }),
  ]);

  await logAudit({
    entityType: 'BLOCKING',
    entityId: req.params.id,
    action: 'SELF_RELEASED',
    performedById: req.user!.userId,
    previousValue: { status: existing.status },
    newValue: { status: 'EXPIRED', reason: parsed.data.reason, salesId: parsed.data.salesId },
  });

  emitHeatmapUpdate();
  emitBlockingUpdate(req.params.id);
  res.json({ ok: true });
});

// PATCH /blocking/:id/deliver
router.patch('/:id/deliver', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ retailId: z.string().min(1) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  if (!isOwner && !isAdmin) { res.status(403).json({ error: 'Forbidden' }); return; }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'DELIVERED' } });
    return tx.blockingRequest.update({
      where: { id: req.params.id },
      data: { status: 'DELIVERED', retailId: parsed.data.retailId, deliveredAt: new Date() },
    });
  });

  await logAudit({ entityType: 'BLOCKING', entityId: req.params.id, action: 'DELIVERED', performedById: req.user!.userId, newValue: { retailId: parsed.data.retailId } });

  emitHeatmapUpdate();
  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

export default router;
