import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireCeo, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireCeo);

// ── 1. Summary KPIs ───────────────────────────────────────────────────────────
router.get('/summary', async (_req: AuthRequest, res: Response) => {
  const baseHard = { blockType: 'HARD' as const, status: 'ACTIVE' as const };

  const [
    physicalStock,
    mddpStock,
    totalBlockings,
    cashBlockings,
    financeBlockings,
    approvedFinance,
    fullPaymentCollected,
  ] = await Promise.all([
    prisma.vehicle.count({ where: { stockStatus: { in: ['BND', 'CTDMS'] }, status: { not: 'DELIVERED' } } }),
    prisma.vehicle.count({ where: { stockStatus: 'MDDP', status: { not: 'DELIVERED' } } }),
    prisma.blockingRequest.count({ where: baseHard }),
    prisma.blockingRequest.count({ where: { ...baseHard, paymentMode: 'CASH' } }),
    prisma.blockingRequest.count({ where: { ...baseHard, paymentMode: 'FINANCE' } }),
    prisma.financeRecord.count({ where: { blockingRequest: baseHard, financeStatus: 'Approved' } }),
    prisma.blockingRequest.count({ where: { ...baseHard, paymentStatus: 'Full Payment Received' } }),
  ]);

  res.json({ physicalStock, mddpStock, totalBlockings, cashBlockings, financeBlockings, approvedFinance, fullPaymentCollected });
});

// ── 2. Stock Status × Chassis Year pivot ─────────────────────────────────────
router.get('/stock-vs-year', async (_req: AuthRequest, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: { not: 'DELIVERED' } },
    select: { stockStatus: true, chassisYear: true },
  });

  const map = new Map<string, number>();
  for (const v of vehicles) {
    const ss = v.stockStatus ?? 'Not Set';
    const key = `${ss}\x01${v.chassisYear}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { stockStatus: string; chassisYear: number; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ stockStatus: key.slice(0, sep), chassisYear: Number(key.slice(sep + 1)), count });
  }
  res.json(rows);
});

// ── 3. Model wise Physical Stock (BND + CTDMS, non-delivered) ─────────────────
router.get('/model-physical-stock', async (_req: AuthRequest, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { stockStatus: { in: ['BND', 'CTDMS'] }, status: { not: 'DELIVERED' } },
    select: { model: true, stockStatus: true },
  });

  const map = new Map<string, number>();
  for (const v of vehicles) {
    const key = `${v.model}\x01${v.stockStatus}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { model: string; stockStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ model: key.slice(0, sep), stockStatus: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 4. Model wise Blocking vs Stock Status (active hard blocks) ───────────────
router.get('/model-blocking-stock', async (_req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', status: 'ACTIVE' },
    select: { vehicle: { select: { model: true, stockStatus: true } } },
  });

  const map = new Map<string, number>();
  for (const b of blockings) {
    const model = b.vehicle.model;
    const ss = b.vehicle.stockStatus ?? 'Unknown';
    const key = `${model}\x01${ss}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { model: string; stockStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ model: key.slice(0, sep), stockStatus: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 5. Model wise Blocking vs Payment Status (active hard blocks) ─────────────
router.get('/model-blocking-payment', async (_req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', status: 'ACTIVE' },
    select: { vehicle: { select: { model: true } }, paymentStatus: true },
  });

  const map = new Map<string, number>();
  for (const b of blockings) {
    const model = b.vehicle.model;
    const ps = b.paymentStatus ?? 'Not Updated';
    const key = `${model}\x01${ps}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { model: string; paymentStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ model: key.slice(0, sep), paymentStatus: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 5b. Branch × Payment Status (active hard blocks) ─────────────────────────
router.get('/branch-blocking-payment', async (_req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', status: 'ACTIVE' },
    select: { branch: { select: { name: true } }, paymentStatus: true },
  });

  const map = new Map<string, number>();
  for (const b of blockings) {
    const branch = b.branch.name;
    const ps = b.paymentStatus ?? 'Not Updated';
    const key = `${branch}\x01${ps}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { branch: string; paymentStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), paymentStatus: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 6. Branch × Ageing pivot (active hard blocks) ────────────────────────────
router.get('/branch-blocking-ageing', async (_req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', status: 'ACTIVE' },
    select: { hardBlockAt: true, branch: { select: { name: true } } },
  });

  const now = new Date();
  const ageBucket = (days: number) => {
    if (days <= 7)  return '0–7 days';
    if (days <= 15) return '8–15 days';
    if (days <= 30) return '16–30 days';
    return '31+ days';
  };

  const map = new Map<string, number>();
  for (const b of blockings) {
    const branch = b.branch.name;
    const days = b.hardBlockAt
      ? Math.floor((now.getTime() - new Date(b.hardBlockAt).getTime()) / 86_400_000)
      : 0;
    const bucket = ageBucket(days);
    const key = `${branch}\x01${bucket}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { branch: string; ageBucket: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), ageBucket: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 7. Branch × Model blocking pivot ─────────────────────────────────────────
router.get('/branch-model-blocking', async (_req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', status: 'ACTIVE' },
    select: {
      branch: { select: { name: true } },
      vehicle: { select: { model: true } },
    },
  });

  const map = new Map<string, number>();
  for (const b of blockings) {
    const key = `${b.branch.name}\x01${b.vehicle.model}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { branch: string; model: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), model: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 8. Branch × Stock Status (for bar chart) ──────────────────────────────────
router.get('/branch-stock-blocking', async (_req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', status: 'ACTIVE' },
    select: {
      branch: { select: { name: true } },
      vehicle: { select: { stockStatus: true } },
    },
  });

  const map = new Map<string, number>();
  for (const b of blockings) {
    const key = `${b.branch.name}\x01${b.vehicle.stockStatus ?? 'Unknown'}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { branch: string; stockStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), stockStatus: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 9. Blockings by Date (last 60 days, for line chart) ───────────────────────
router.get('/blockings-by-date', async (_req: AuthRequest, res: Response) => {
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', hardBlockAt: { gte: since } },
    select: { hardBlockAt: true },
    orderBy: { hardBlockAt: 'asc' },
  });

  const map = new Map<string, number>();
  for (const b of blockings) {
    if (!b.hardBlockAt) continue;
    const date = new Date(b.hardBlockAt).toISOString().slice(0, 10);
    map.set(date, (map.get(date) ?? 0) + 1);
  }

  const rows = Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  res.json(rows);
});

// ── 10. Expected Billing Pipeline ─────────────────────────────────────────────
router.get('/billing-pipeline', async (_req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', status: 'ACTIVE', expectedBillingDate: { not: null } },
    select: { expectedBillingDate: true },
    orderBy: { expectedBillingDate: 'asc' },
  });

  const map = new Map<string, number>();
  for (const b of blockings) {
    if (!b.expectedBillingDate) continue;
    const date = new Date(b.expectedBillingDate).toISOString().slice(0, 10);
    map.set(date, (map.get(date) ?? 0) + 1);
  }

  const rows = Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  res.json(rows);
});

// ── 11a. Ageing Stock — Physical BND/CTDMS (model × age bucket, OPEN + BLOCKED) ─
const STOCK_AGE_BUCKETS = ['<30d', '30-50d', '51-70d', '71-100d', '101-150d', '150+d'] as const;
function stockAgeBucket(days: number): string {
  if (days < 30)  return '<30d';
  if (days < 51)  return '30-50d';
  if (days < 71)  return '51-70d';
  if (days < 101) return '71-100d';
  if (days < 151) return '101-150d';
  return '150+d';
}

router.get('/stock-ageing', async (_req: AuthRequest, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      stockStatus: { in: ['BND', 'CTDMS'] },
      status: { in: ['OPEN', 'SOFT_BLOCKED', 'HARD_BLOCKED'] },
    },
    select: { model: true, assignmentDate: true, createdAt: true },
  });

  const now = new Date();
  const map = new Map<string, number>();
  for (const v of vehicles) {
    const ref = v.assignmentDate ?? v.createdAt;
    const days = Math.floor((now.getTime() - new Date(ref).getTime()) / 86_400_000);
    const bucket = stockAgeBucket(days);
    const key = `${v.model}\x01${bucket}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { model: string; ageBucket: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ model: key.slice(0, sep), ageBucket: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 11b. Active Blockings Ageing — Physical BND/CTDMS (model × age bucket) ───
router.get('/blocking-stock-ageing', async (_req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: {
      blockType: 'HARD',
      status: 'ACTIVE',
      vehicle: { stockStatus: { in: ['BND', 'CTDMS'] } },
    },
    select: {
      vehicle: { select: { model: true, assignmentDate: true, createdAt: true } },
    },
  });

  const now = new Date();
  const map = new Map<string, number>();
  for (const b of blockings) {
    const ref = b.vehicle.assignmentDate ?? b.vehicle.createdAt;
    const days = Math.floor((now.getTime() - new Date(ref).getTime()) / 86_400_000);
    const bucket = stockAgeBucket(days);
    const key = `${b.vehicle.model}\x01${bucket}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { model: string; ageBucket: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ model: key.slice(0, sep), ageBucket: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 11. Release to Pool Analysis ──────────────────────────────────────────────
router.get('/release-analysis', async (_req: AuthRequest, res: Response) => {
  // Get all self-releases from audit log (last 180 days)
  const since = new Date();
  since.setDate(since.getDate() - 180);

  const logs = await prisma.auditLog.findMany({
    where: { action: 'SELF_RELEASED', performedAt: { gte: since } },
    select: { entityId: true, newValue: true, performedAt: true },
  });

  if (!logs.length) { res.json({ branches: [], reasons: [] }); return; }

  // Get blocking branch info for all entity IDs
  const entityIds = logs.map((l) => l.entityId);
  const blockings = await prisma.blockingRequest.findMany({
    where: { id: { in: entityIds } },
    select: { id: true, branch: { select: { name: true } } },
  });
  const branchByBlockingId = new Map(blockings.map((b) => [b.id, b.branch.name]));

  const branchMap = new Map<string, number>();
  const reasonMap = new Map<string, number>();

  for (const log of logs) {
    const branch = branchByBlockingId.get(log.entityId) ?? 'Unknown';
    branchMap.set(branch, (branchMap.get(branch) ?? 0) + 1);

    const nv = log.newValue as { reason?: string } | null;
    const reason = nv?.reason ?? 'Unknown';
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
  }

  const totalReleases = logs.length;

  const branches = Array.from(branchMap.entries())
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count);

  const reasons = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count, pct: Math.round((count / totalReleases) * 100) }))
    .sort((a, b) => b.count - a.count);

  res.json({ total: totalReleases, branches, reasons });
});

// ── 11b. Model × Purchase Mode ────────────────────────────────────────────────
router.get('/model-purchase', async (_req: AuthRequest, res: Response) => {
  const [records, noRecord] = await Promise.all([
    prisma.financeRecord.findMany({
      where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' } },
      select: {
        purchaseMode: true,
        blockingRequest: { select: { vehicle: { select: { model: true } } } },
      },
    }),
    prisma.blockingRequest.findMany({
      where: { blockType: 'HARD', status: 'ACTIVE', financeRecord: null },
      select: { vehicle: { select: { model: true } } },
    }),
  ]);

  const map = new Map<string, number>();
  for (const r of records) {
    const key = `${r.blockingRequest.vehicle.model}\x01${r.purchaseMode ?? 'Not Set'}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  for (const b of noRecord) {
    const key = `${b.vehicle.model}\x01Not Updated`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { model: string; purchaseMode: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ model: key.slice(0, sep), purchaseMode: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 11c. Model × Finance Status (In House only) ───────────────────────────────
router.get('/model-finance-status', async (_req: AuthRequest, res: Response) => {
  const records = await prisma.financeRecord.findMany({
    where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' }, purchaseMode: 'In House' },
    select: {
      financeStatus: true,
      blockingRequest: { select: { vehicle: { select: { model: true } } } },
    },
  });

  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.financeStatus) continue;
    const key = `${r.blockingRequest.vehicle.model}\x01${r.financeStatus}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { model: string; financeStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ model: key.slice(0, sep), financeStatus: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 12. Full Payment Ageing (BND/CTDMS physical stock only) ──────────────────
router.get('/full-payment-ageing', async (_req: AuthRequest, res: Response) => {
  const blockings = await prisma.blockingRequest.findMany({
    where: {
      blockType: 'HARD',
      status: 'ACTIVE',
      paymentStatus: 'Full Payment Received',
      fullPaymentAt: { not: null },
      vehicle: { stockStatus: { in: ['BND', 'CTDMS'] } },
    },
    select: {
      fullPaymentAt: true,
      branch: { select: { name: true } },
    },
  });

  const now = new Date();
  const map = new Map<string, number>();
  for (const b of blockings) {
    const days = Math.floor((now.getTime() - new Date(b.fullPaymentAt!).getTime()) / 86_400_000);
    const bucket = days >= 8 ? '8+' : String(days);
    const key = `${b.branch.name}\x01${bucket}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { branch: string; dayBucket: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), dayBucket: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 13. Finance KPI Summary ───────────────────────────────────────────────────
router.get('/finance-summary', async (_req: AuthRequest, res: Response) => {
  const baseHard = { blockType: 'HARD' as const, status: 'ACTIVE' as const };
  const finWhere = { blockingRequest: baseHard };

  const [totalBlockings, untouched, inHouse, loginPending, loggedApprovalPending, loggedDocsPending, approved, disbursed] =
    await Promise.all([
      prisma.blockingRequest.count({ where: baseHard }),
      prisma.blockingRequest.count({ where: { ...baseHard, financeRecord: null } }),
      prisma.financeRecord.count({ where: { ...finWhere, purchaseMode: 'In House' } }),
      prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Login Pending' } }),
      prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Logged Approval Pending' } }),
      prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Logged Document Pending' } }),
      prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Approved' } }),
      prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Disbursed' } }),
    ]);

  res.json({ totalBlockings, untouched, inHouse, loginPending, loggedApprovalPending, loggedDocsPending, approved, disbursed });
});

// ── 13. Finance Branch × Purchase Mode ───────────────────────────────────────
router.get('/finance-branch-purchase', async (_req: AuthRequest, res: Response) => {
  const baseHard = { blockType: 'HARD' as const, status: 'ACTIVE' as const };
  const [records, blockings] = await Promise.all([
    prisma.financeRecord.findMany({
      where: { blockingRequest: baseHard },
      select: { purchaseMode: true, blockingRequest: { select: { branch: { select: { name: true } } } } },
    }),
    prisma.blockingRequest.findMany({
      where: baseHard,
      select: { branch: { select: { name: true } }, financeRecord: { select: { id: true } } },
    }),
  ]);

  const map = new Map<string, number>();
  for (const r of records) {
    const key = `${r.blockingRequest.branch.name}\x01${r.purchaseMode ?? 'Not Set'}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  for (const b of blockings) {
    if (!b.financeRecord) {
      const key = `${b.branch.name}\x01Not Updated`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }

  const rows: { branch: string; purchaseMode: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), purchaseMode: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 14. Finance Branch × Finance Status ──────────────────────────────────────
router.get('/finance-branch-status', async (_req: AuthRequest, res: Response) => {
  const records = await prisma.financeRecord.findMany({
    where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE' }, purchaseMode: 'In House' },
    select: { financeStatus: true, blockingRequest: { select: { branch: { select: { name: true } } } } },
  });

  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.financeStatus) continue;
    const key = `${r.blockingRequest.branch.name}\x01${r.financeStatus}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { branch: string; financeStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), financeStatus: key.slice(sep + 1), count });
  }
  res.json(rows);
});

// ── 15. Finance Bank × Count ──────────────────────────────────────────────────
router.get('/finance-bank', async (_req: AuthRequest, res: Response) => {
  const records = await prisma.financeRecord.findMany({
    where: {
      blockingRequest: { blockType: 'HARD', status: 'ACTIVE' },
      bankName: { not: null },
    },
    select: { bankName: true },
  });

  const map = new Map<string, number>();
  for (const r of records) {
    const bank = r.bankName!;
    map.set(bank, (map.get(bank) ?? 0) + 1);
  }

  const rows = Array.from(map.entries())
    .map(([bankName, count]) => ({ bankName, count }))
    .sort((a, b) => b.count - a.count);

  res.json(rows);
});

export default router;
