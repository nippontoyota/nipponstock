import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireFinanceHead, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireFinanceHead);

// ── KPI Summary ───────────────────────────────────────────────────────────────
router.get('/summary', async (_req: AuthRequest, res: Response) => {
  const [
    totalBlockings,
    untouched,
    inHouse,
    loginPending,
    loggedApprovalPending,
    loggedDocsPending,
    approved,
    disbursed,
  ] = await Promise.all([
    // All active hard blockings
    prisma.blockingRequest.count({ where: { blockType: 'HARD', status: 'ACTIVE' } }),
    // No finance record at all
    prisma.blockingRequest.count({ where: { blockType: 'HARD', status: 'ACTIVE', financeRecord: null } }),
    // Purchase mode = In House
    prisma.financeRecord.count({
      where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' }, purchaseMode: 'In House' },
    }),
    // Finance status = Login Pending
    prisma.financeRecord.count({
      where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' }, financeStatus: 'Login Pending' },
    }),
    // Finance status = Logged, Approval Pending
    prisma.financeRecord.count({
      where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' }, financeStatus: 'Logged, Approval Pending' },
    }),
    // Finance status = Logged, Documents Pending
    prisma.financeRecord.count({
      where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' }, financeStatus: 'Logged, Documents Pending' },
    }),
    // Finance status = Approved
    prisma.financeRecord.count({
      where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' }, financeStatus: 'Approved' },
    }),
    // Finance status = Disbursed
    prisma.financeRecord.count({
      where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' }, financeStatus: 'Disbursed' },
    }),
  ]);

  res.json({
    totalBlockings,
    untouched,
    inHouse,
    loginPending,
    loggedApprovalPending,
    loggedDocsPending,
    approved,
    disbursed,
  });
});

// ── Branch × Purchase Mode pivot ──────────────────────────────────────────────
router.get('/branch-purchase', async (_req: AuthRequest, res: Response) => {
  const records = await prisma.financeRecord.findMany({
    where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' } },
    select: {
      purchaseMode: true,
      blockingRequest: { select: { branch: { select: { name: true } } } },
    },
  });

  // Also count untouched per branch (active hard blocks with no finance record)
  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', status: 'ACTIVE' },
    select: { id: true, branch: { select: { name: true } }, financeRecord: { select: { id: true } } },
  });

  const rows: { branch: string; purchaseMode: string; count: number }[] = [];
  const map = new Map<string, number>();

  for (const r of records) {
    const branch = r.blockingRequest.branch.name;
    const mode = r.purchaseMode ?? 'Not Set';
    const key = `${branch}\x01${mode}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  // Untouched (no finance record) per branch
  for (const b of blockings) {
    if (!b.financeRecord) {
      const key = `${b.branch.name}\x01Not Updated`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }

  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), purchaseMode: key.slice(sep + 1), count });
  }

  res.json(rows);
});

// ── Branch × Finance Status pivot ─────────────────────────────────────────────
router.get('/branch-status', async (_req: AuthRequest, res: Response) => {
  const records = await prisma.financeRecord.findMany({
    where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' } },
    select: {
      financeStatus: true,
      blockingRequest: { select: { branch: { select: { name: true } } } },
    },
  });

  const map = new Map<string, number>();

  for (const r of records) {
    if (!r.financeStatus) continue;
    const branch = r.blockingRequest.branch.name;
    const key = `${branch}\x01${r.financeStatus}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { branch: string; financeStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), financeStatus: key.slice(sep + 1), count });
  }

  res.json(rows);
});

export default router;
