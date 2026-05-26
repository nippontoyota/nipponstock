import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireFinanceOfficer, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireFinanceOfficer);

// ── Summary / KPI ─────────────────────────────────────────────────────────────
router.get('/summary', async (req: AuthRequest, res: Response) => {
  const branchId = req.user!.branchId;
  if (!branchId) { res.status(403).json({ error: 'No branch assigned' }); return; }

  const now = new Date();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [mtdCount, untouchedCount] = await Promise.all([
    // MTD: hard blockings created in the current calendar month
    prisma.blockingRequest.count({
      where: {
        branchId,
        blockType: 'HARD',
        status: 'ACTIVE',
        hardBlockAt: { gte: mtdStart },
      },
    }),
    // Untouched: active hard blockings with no finance record yet
    prisma.blockingRequest.count({
      where: {
        branchId,
        blockType: 'HARD',
        status: 'ACTIVE',
        financeRecord: null,
      },
    }),
  ]);

  res.json({ mtdCount, untouchedCount });
});

// ── All hard blockings for this branch (ACTIVE) ───────────────────────────────
router.get('/blockings', async (req: AuthRequest, res: Response) => {
  const branchId = req.user!.branchId;
  if (!branchId) { res.status(403).json({ error: 'No branch assigned' }); return; }

  const blockings = await prisma.blockingRequest.findMany({
    where: { branchId, blockType: 'HARD', status: 'ACTIVE' },
    orderBy: { hardBlockAt: 'desc' },
    include: {
      vehicle: { select: { model: true, suffix: true, colour: true, chassisYear: true, chassisNumber: true, stockStatus: true } },
      user: { select: { fullName: true } },
      financeRecord: true,
    },
  });

  res.json(blockings);
});

// ── PATCH payment status (FO can update their branch blockings) ───────────────
router.patch('/blockings/:id/payment-status', async (req: AuthRequest, res: Response) => {
  const branchId = req.user!.branchId;
  if (!branchId) { res.status(403).json({ error: 'No branch assigned' }); return; }

  const Schema = z.object({ paymentStatus: z.string().min(1) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const blocking = await prisma.blockingRequest.findUnique({ where: { id: req.params.id } });
  if (!blocking) { res.status(404).json({ error: 'Not found' }); return; }
  if (blocking.branchId !== branchId) { res.status(403).json({ error: 'Access denied' }); return; }

  const updated = await prisma.blockingRequest.update({
    where: { id: req.params.id },
    data: { paymentStatus: parsed.data.paymentStatus },
    include: {
      vehicle: { select: { model: true, suffix: true, colour: true, chassisYear: true, chassisNumber: true, stockStatus: true } },
      user: { select: { fullName: true } },
      financeRecord: true,
    },
  });

  res.json(updated);
});

// ── Upsert finance record ─────────────────────────────────────────────────────
const RecordSchema = z.object({
  purchaseMode: z.enum(['In House', 'Out House', 'Cash', 'Leasing', 'No Idea']).optional().nullable(),
  bankName: z.string().optional().nullable(),
  loanAmount: z.number().optional().nullable(),
  financeStatus: z.enum([
    'Login Pending',
    'Logged Document Pending',
    'Logged Approval Pending',
    'Approved',
    'Agreement Done',
    'Disbursed',
    'Full Payment Received',
    'Rejected',
  ]).optional().nullable(),
  expectedDisbursementDate: z.string().datetime().optional().nullable(),
  otherRemarks: z.string().optional().nullable(),
});

router.put('/blockings/:id/record', async (req: AuthRequest, res: Response) => {
  const branchId = req.user!.branchId;
  if (!branchId) { res.status(403).json({ error: 'No branch assigned' }); return; }

  // Verify this blocking belongs to the finance officer's branch
  const blocking = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    select: { id: true, branchId: true, blockType: true, status: true },
  });
  if (!blocking) { res.status(404).json({ error: 'Blocking not found' }); return; }
  if (blocking.branchId !== branchId) { res.status(403).json({ error: 'Access denied' }); return; }

  const parsed = RecordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const data = {
    ...parsed.data,
    expectedDisbursementDate: parsed.data.expectedDisbursementDate
      ? new Date(parsed.data.expectedDisbursementDate)
      : null,
  };

  const record = await prisma.financeRecord.upsert({
    where: { blockingRequestId: req.params.id },
    update: data,
    create: { blockingRequestId: req.params.id, ...data },
  });

  res.json(record);
});

export default router;
