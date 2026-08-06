import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { getBlockingDays } from '../services/modelDuration';
import { logAudit } from '../services/audit';
import { emitHeatmapUpdate, emitBlockingUpdate } from '../services/events';

const router = Router();
router.use(authenticate);

// Canonical payment status values — enforced at every write point
const PAYMENT_STATUSES = [
  'Down Payment Received',
  'Only Booking Received',
  'Part Payment Received',
  'Full Payment Received',
  'Ready for Disbursement',
] as const;
const paymentStatusEnum = z.enum(PAYMENT_STATUSES);

// Expiry = 11:00 PM IST on the Nth day from today (IST date)
function hardBlockExpiry(days: number): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  // Midnight IST on (today + days) expressed as a UTC timestamp
  const expiryMidnightIst = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate() + days,
  );
  // 23:00 IST = midnight IST + 23 h, then subtract IST offset to get UTC
  return new Date(expiryMidnightIst - IST_OFFSET_MS + 23 * 60 * 60 * 1000);
}

// When paymentStatus changes to/from 'Full Payment Received', update expiryAt + fullPaymentAt
function fullPaymentFields(newStatus: string, existingStatus?: string | null): Record<string, unknown> {
  if (newStatus === 'Full Payment Received') {
    return { expiryAt: null, fullPaymentAt: new Date() };
  }
  if (existingStatus === 'Full Payment Received') {
    // Moving away from Full Payment Received — clear the timestamp (expiry restored by admin if needed)
    return { fullPaymentAt: null };
  }
  return {};
}

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

  // Trim to guard against trailing spaces from Excel-imported data
  const model = parsed.data.model.trim();
  const suffix = parsed.data.suffix.trim();
  const colour = parsed.data.colour.trim();
  const { chassisYear } = parsed.data;
  const userId = req.user!.userId;
  const branchId = req.user!.branchId;

  if (!branchId) { res.status(403).json({ error: 'No branch assigned to your account — contact admin' }); return; }

  // Atomic: find an OPEN vehicle and soft-block it in a single transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Fetch all OPEN candidates for this year (if specified) and filter with trim
      // so that trailing spaces in Excel-imported data never block a booking
      const candidates = await tx.vehicle.findMany({
        where: {
          status: 'OPEN',
          hiddenFromHeatmap: false,
          ...(chassisYear ? { chassisYear } : {}),
        },
        select: { id: true, model: true, suffix: true, colour: true, stockStatus: true, chassisYear: true, assignmentDate: true, chassisNumber: true },
      });

      // Strip ALL unicode whitespace (including non-breaking spaces  , zero-width, etc.)
      const clean = (s: string) => s.replace(/[ ​﻿\s]+/g, ' ').trim();

      const matching = candidates.filter(
        (v) => clean(v.model) === clean(model) && clean(v.suffix) === clean(suffix) && clean(v.colour) === clean(colour),
      );


      // Sort: earliest assignmentDate first (chassisYear is fixed by the request filter or irrelevant)
      matching.sort((a, b) => {
        const aDate = a.assignmentDate ? new Date(a.assignmentDate).getTime() : 0;
        const bDate = b.assignmentDate ? new Date(b.assignmentDate).getTime() : 0;
        return aDate - bDate;
      });

      // Priority: BND → CTDMS → MDDP → any (within each tier, sort order above applies)
      const PRIORITY = ['BND', 'CTDMS', 'MDDP'] as const;
      let vehicle: { id: string; chassisNumber: string; model: string; suffix: string; colour: string; stockStatus: string | null; chassisYear: number; assignmentDate: Date | null } | null = null;
      for (const ss of PRIORITY) {
        vehicle = matching.find((v) => v.stockStatus === ss) ?? null;
        if (vehicle) break;
      }
      if (!vehicle) vehicle = matching[0] ?? null;

      console.log(`[soft-block] query="${model}/${suffix}/${colour}" candidates=${candidates.length} matching=${matching.length} picked=${vehicle?.id ?? 'NONE'}`);

      if (!vehicle) throw new Error(chassisYear ? `NO_VEHICLE_YEAR_${chassisYear}` : 'NO_VEHICLE');

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

      return { ...blocking, chassisNumber: vehicle.chassisNumber, model: vehicle.model };
    });

    emitHeatmapUpdate();
    res.status(201).json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'NO_VEHICLE') {
      res.status(409).json({ error: 'No open vehicle found for this combination — please select again' });
    } else if (msg.startsWith('NO_VEHICLE_YEAR_')) {
      const yr = msg.split('_').pop();
      res.status(409).json({ error: `No open ${yr} unit available for this variant. Try clearing the YOM filter to see all years.` });
    } else {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// GET /blocking/offer-vehicles — OPEN vehicles for offers page (frontend does incentive lookup)
router.get('/offer-vehicles', async (_req: AuthRequest, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'OPEN', hiddenFromHeatmap: false },
    select: { model: true, suffix: true, colour: true, chassisNumber: true, assignmentDate: true, stockStatus: true, chassisYear: true },
    orderBy: { assignmentDate: 'asc' },
  });
  res.json(vehicles);
});

// POST /blocking/offer-soft — soft block by model+suffix (earliest assignmentDate, BND→CTDMS priority)
router.post('/offer-soft', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ model: z.string().min(1), suffix: z.string().min(1) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const model = parsed.data.model.trim();
  const suffix = parsed.data.suffix.trim();
  const userId = req.user!.userId;
  const branchId = req.user!.branchId;
  if (!branchId) { res.status(403).json({ error: 'No branch assigned' }); return; }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const candidates = await tx.vehicle.findMany({
        where: { status: 'OPEN', hiddenFromHeatmap: false },
        select: { id: true, model: true, suffix: true, chassisNumber: true, assignmentDate: true, stockStatus: true },
        orderBy: { assignmentDate: 'asc' },
      });

      const clean = (s: string) => s.replace(/[\s ​﻿]+/g, ' ').trim();
      const matching = candidates.filter(
        (v) => clean(v.model) === clean(model) && clean(v.suffix) === clean(suffix),
      );

      const PRIORITY = ['BND', 'CTDMS', 'MDDP'] as const;
      let vehicle: { id: string; chassisNumber: string; model: string } | null = null;
      for (const ss of PRIORITY) {
        vehicle = matching.find((v) => v.stockStatus === ss) ?? null;
        if (vehicle) break;
      }
      if (!vehicle) vehicle = matching[0] ?? null;
      if (!vehicle) throw new Error('NO_VEHICLE');

      await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: 'SOFT_BLOCKED' } });
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
      return { ...blocking, chassisNumber: vehicle.chassisNumber };
    });

    emitHeatmapUpdate();
    res.status(201).json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'NO_VEHICLE') {
      res.status(409).json({ error: 'No open vehicle found for this combination' });
    } else {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// POST /blocking/hard — convert soft to hard block
router.post('/hard', async (req: AuthRequest, res: Response) => {
  const isTeamLeader = req.user!.role === 'TEAM_LEADER';

  // Team Leaders only submit customer credentials — no financial payload
  const TLSchema = z.object({
    blockingId: z.string().uuid(),
    chassisYear: z.number().int(),
    orderId: z.string().min(1),
    customerName: z.string().min(1),
    consultantName: z.string().min(1),
    teamLeaderName: z.string().optional(),
  });

  const SMSchema = z.object({
    blockingId: z.string().uuid(),
    chassisYear: z.number().int(),
    orderId: z.string().min(1),
    customerName: z.string().min(1),
    consultantName: z.string().min(1),
    teamLeaderName: z.string().optional(),
    paymentMode: z.enum(['CASH', 'FINANCE']),
    amountReceived: z.number().optional(),
    financierBank: z.string().optional(),
    paymentStatus: paymentStatusEnum,
    expectedBillingDate: z.string().datetime().optional(),
  });

  const parsed = isTeamLeader ? TLSchema.safeParse(req.body) : SMSchema.safeParse(req.body);
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
  const defaultExpiry = hardBlockExpiry(days);

  // Team Leaders have no paymentStatus, so no full-payment logic
  const paymentStatus = (formData as { paymentStatus?: string }).paymentStatus;
  const fpFields = paymentStatus ? fullPaymentFields(paymentStatus) : {};
  const expiryAt = (fpFields as { expiryAt?: Date | null }).expiryAt !== undefined
    ? ((fpFields as { expiryAt: Date | null }).expiryAt)
    : defaultExpiry;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: existing.vehicleId },
        data: { chassisYear, status: 'HARD_BLOCKED' },
      });

      const { expectedBillingDate, ...restFormData } = formData as typeof formData & { expectedBillingDate?: string };
      return tx.blockingRequest.update({
        where: { id: blockingId },
        data: {
          blockType: 'HARD',
          hardBlockAt: new Date(),
          expiryAt,
          ...fpFields,
          ...restFormData,
          ...(expectedBillingDate ? { expectedBillingDate: new Date(expectedBillingDate) } : {}),
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

// POST /blocking/admin-block — admin creates a hard block directly on behalf of a sales manager
router.post('/admin-block', requireAdmin, async (req: AuthRequest, res: Response) => {
  const Schema = z.object({
    vehicleId: z.string().min(1),
    onBehalfOfUserId: z.string().min(1),
    orderId: z.string().regex(/^\d{7}$/, 'Order ID must be exactly 7 digits'),
    customerName: z.string().min(1),
    consultantName: z.string().min(1),
    teamLeaderName: z.string().optional(),
    paymentMode: z.enum(['CASH', 'FINANCE']),
    amountReceived: z.number().optional(),
    financierBank: z.string().optional(),
    paymentStatus: paymentStatusEnum,
    expectedBillingDate: z.string().datetime().optional(),
  });

  console.log('[admin-block] body:', JSON.stringify(req.body));
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    const message = Object.entries(fields).map(([k, v]) => `${k}: ${v?.join(', ')}`).join(' | ') || 'Invalid request';
    console.log('[admin-block] validation failed:', message);
    res.status(400).json({ error: message });
    return;
  }

  const { vehicleId, onBehalfOfUserId, ...formData } = parsed.data;

  // Get the user and their branch (before transaction — read-only, safe)
  const onBehalfUser = await prisma.user.findUnique({ where: { id: onBehalfOfUserId }, select: { id: true, branchId: true, fullName: true } });
  if (!onBehalfUser) { res.status(404).json({ error: 'User not found' }); return; }
  if (!onBehalfUser.branchId) { res.status(400).json({ error: 'Selected user has no branch assigned' }); return; }

  // Pre-fetch vehicle for getBlockingDays (model/stockStatus needed before tx)
  const vehicleCheck = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicleCheck) { res.status(404).json({ error: 'Vehicle not found' }); return; }

  const days = await getBlockingDays(vehicleCheck.model, vehicleCheck.stockStatus);
  const now = new Date();
  const defaultExpiry = hardBlockExpiry(days);
  const fpFields = fullPaymentFields(formData.paymentStatus);
  const expiryAt = fpFields.expiryAt !== undefined ? (fpFields.expiryAt as Date | null) : defaultExpiry;

  try {
    const blocking = await prisma.$transaction(async (tx) => {
      // ── Atomic OPEN check + status flip ──────────────────────────────────────
      // updateMany returns count=0 if vehicle is not OPEN, preventing race conditions
      // where two admins block the same vehicle simultaneously.
      const claimed = await tx.vehicle.updateMany({
        where: { id: vehicleId, status: 'OPEN' },
        data: { status: 'HARD_BLOCKED' },
      });
      if (claimed.count === 0) throw new Error('VEHICLE_NOT_OPEN');
      return tx.blockingRequest.create({
        data: {
          vehicleId,
          userId: onBehalfUser.id,
          branchId: onBehalfUser.branchId!,
          blockType: 'HARD',
          softBlockAt: now,
          hardBlockAt: now,
          expiryAt,
          ...(fpFields.fullPaymentAt ? { fullPaymentAt: fpFields.fullPaymentAt as Date } : {}),
          orderId: formData.orderId,
          customerName: formData.customerName,
          consultantName: formData.consultantName,
          teamLeaderName: formData.teamLeaderName,
          paymentMode: formData.paymentMode,
          amountReceived: formData.amountReceived,
          financierBank: formData.financierBank,
          paymentStatus: formData.paymentStatus,
          expectedBillingDate: formData.expectedBillingDate ? new Date(formData.expectedBillingDate) : undefined,
        },
        include: { vehicle: true, branch: true },
      });
    });

    await logAudit({
      entityType: 'BLOCKING',
      entityId: blocking.id,
      action: 'ADMIN_HARD_BLOCKED',
      performedById: req.user!.userId,
      newValue: { onBehalfOf: onBehalfUser.fullName, vehicleId, expiryAt },
    });

    emitHeatmapUpdate();
    emitBlockingUpdate(blocking.id);
    res.status(201).json(blocking);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'VEHICLE_NOT_OPEN') {
      res.status(409).json({ error: 'Vehicle is not open — it may have just been taken by another user' });
    } else {
      res.status(500).json({ error: 'Failed to create block', detail: msg });
    }
  }
});

// PATCH /blocking/:id/details — owner updates customer name, order ID, expected billing date, consultant, team leader
router.patch('/:id/details', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({
    customerName: z.string().optional(),
    orderId: z.string().optional(),
    expectedBillingDate: z.string().datetime().nullable().optional(),
    consultantName: z.string().optional(),
    teamLeaderName: z.string().optional(),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { role: true, branchId: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  // Sales Manager can edit Team Leader blockings from their own branch
  const isSmEditingTl = req.user!.role === 'SALES_MANAGER'
    && (existing.user.role as string) === 'TEAM_LEADER'
    && existing.user.branchId === req.user!.branchId;
  if (!isOwner && !isAdmin && !isSmEditingTl) { res.status(403).json({ error: 'Forbidden' }); return; }

  if (existing.status !== 'ACTIVE') { res.status(409).json({ error: 'Booking is not active' }); return; }

  const data: Record<string, unknown> = {};
  if (parsed.data.customerName !== undefined) data.customerName = parsed.data.customerName;
  if (parsed.data.orderId !== undefined) data.orderId = parsed.data.orderId;
  if (parsed.data.expectedBillingDate !== undefined) {
    data.expectedBillingDate = parsed.data.expectedBillingDate ? new Date(parsed.data.expectedBillingDate) : null;
  }
  if (parsed.data.consultantName !== undefined) data.consultantName = parsed.data.consultantName;
  if (parsed.data.teamLeaderName !== undefined) data.teamLeaderName = parsed.data.teamLeaderName;

  const updated = await prisma.blockingRequest.update({ where: { id: req.params.id }, data });

  await logAudit({
    entityType: 'BLOCKING',
    entityId: req.params.id,
    action: 'DETAILS_UPDATED',
    performedById: req.user!.userId,
    previousValue: { customerName: existing.customerName, orderId: existing.orderId, expectedBillingDate: existing.expectedBillingDate },
    newValue: data,
  });

  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

// PATCH /blocking/:id/payment-status — owner or SM (for TL bookings in same branch) updates payment status
router.patch('/:id/payment-status', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ paymentStatus: z.string().min(1) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { role: true, branchId: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const isSmOverTl = req.user!.role === 'SALES_MANAGER'
    && (existing.user.role as string) === 'TEAM_LEADER'
    && existing.user.branchId === req.user!.branchId;
  if (!isOwner && !isAdmin && !isSmOverTl) { res.status(403).json({ error: 'Forbidden' }); return; }

  if (existing.status !== 'ACTIVE') { res.status(409).json({ error: 'Booking is not active' }); return; }

  const fpFields = fullPaymentFields(parsed.data.paymentStatus, existing.paymentStatus);
  const updated = await prisma.blockingRequest.update({
    where: { id: req.params.id },
    data: { paymentStatus: parsed.data.paymentStatus, ...fpFields },
    include: { vehicle: true },
  });

  await logAudit({
    entityType: 'BLOCKING',
    entityId: req.params.id,
    action: 'PAYMENT_STATUS_UPDATED',
    performedById: req.user!.userId,
    previousValue: { paymentStatus: existing.paymentStatus },
    newValue: { paymentStatus: parsed.data.paymentStatus },
  });

  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

// GET /blocking/my
router.get('/my', async (req: AuthRequest, res: Response) => {
  const { userId, role, branchId } = req.user!;

  // Sales Managers also see blockings made by Team Leaders in the same branch
  const where = role === 'SALES_MANAGER' && branchId
    ? { OR: [{ userId }, { user: { role: 'TEAM_LEADER' as const, branchId } }] }
    : { userId };

  const blockings = await prisma.blockingRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      vehicle: true,
      branch: { select: { name: true } },
      financeRecord: true,
      user: { select: { id: true, fullName: true, role: true } },
    },
  });

  res.json(blockings);
});

// GET /blocking/all — admin
router.get('/all', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { branchId, status, blockType, model, chassis, search, from, to, blockedFrom, blockedTo, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (blockType) where.blockType = blockType;

  // Vehicle filter — model and/or chassis
  const vehicleFilter: Record<string, unknown> = {};
  if (model) vehicleFilter.model = { contains: model, mode: 'insensitive' };
  if (chassis) vehicleFilter.chassisNumber = { contains: chassis, mode: 'insensitive' };
  if (Object.keys(vehicleFilter).length > 0) where.vehicle = vehicleFilter;

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
  if (blockedFrom || blockedTo) {
    where.hardBlockAt = {
      ...(blockedFrom ? { gte: new Date(blockedFrom) } : {}),
      ...(blockedTo ? { lte: new Date(new Date(blockedTo).setHours(23, 59, 59, 999)) } : {}),
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
    paymentStatus: paymentStatusEnum.optional(),
    expectedBillingDate: z.string().datetime().optional(),
    adminNotes: z.string().optional(),
  });

  const parsed = EditSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.expectedBillingDate) data.expectedBillingDate = new Date(parsed.data.expectedBillingDate);
  if (parsed.data.paymentStatus) Object.assign(data, fullPaymentFields(parsed.data.paymentStatus, existing.paymentStatus));

  const updated = await prisma.blockingRequest.update({
    where: { id: req.params.id },
    data,
    include: { vehicle: true },
  });

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
    prisma.blockingRequest.update({ where: { id: req.params.id }, data: { status: 'EXPIRED', adminNotes: 'Manually released by admin' } }),
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

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { vehicle: true, user: { select: { role: true, branchId: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const isSmOverTl = req.user!.role === 'SALES_MANAGER'
    && (existing.user.role as string) === 'TEAM_LEADER'
    && existing.user.branchId === req.user!.branchId;
  if (!isOwner && !isAdmin && !isSmOverTl) { res.status(403).json({ error: 'Forbidden' }); return; }

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

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { role: true, branchId: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const isSmOverTl = req.user!.role === 'SALES_MANAGER'
    && (existing.user.role as string) === 'TEAM_LEADER'
    && existing.user.branchId === req.user!.branchId;
  if (!isOwner && !isAdmin && !isSmOverTl) { res.status(403).json({ error: 'Forbidden' }); return; }

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
