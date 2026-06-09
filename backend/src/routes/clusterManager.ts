import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireClusterManager, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireClusterManager);

// ── Cluster branch code mapping ───────────────────────────────────────────────
const CLUSTER_BRANCHES: Record<number, string[]> = {
  1: ['CO01A', 'CO01B', 'KY01A'],
  2: ['TR01A', 'TR01C', 'KL01A'],
  3: ['IR01A', 'TI01A', 'MV01A'],
  4: ['KT01A', 'PH01A', 'TL01A'],
};

async function getClusterBranchIds(clusterNumber: number): Promise<string[]> {
  const codes = CLUSTER_BRANCHES[clusterNumber] ?? [];
  if (!codes.length) return [];
  const branches = await prisma.branch.findMany({
    where: { branchCode: { in: codes } },
    select: { id: true },
  });
  return branches.map((b) => b.id);
}

// ── MTD KPI Summary ────────────────────────────────────────────────────────────
router.get('/summary', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const branchIds = await getClusterBranchIds(clusterNumber);
  if (!branchIds.length) { res.json({ mtdBlocked: 0, mtdCash: 0, mtdFinance: 0, mtdReleased: 0 }); return; }

  const now = new Date();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [mtdBlocked, mtdCash, mtdFinance, mtdReleased] = await Promise.all([
    prisma.blockingRequest.count({
      where: { branchId: { in: branchIds }, blockType: 'HARD', status: 'ACTIVE', hardBlockAt: { gte: mtdStart } },
    }),
    prisma.blockingRequest.count({
      where: { branchId: { in: branchIds }, blockType: 'HARD', status: 'ACTIVE', hardBlockAt: { gte: mtdStart }, paymentMode: 'CASH' },
    }),
    prisma.blockingRequest.count({
      where: { branchId: { in: branchIds }, blockType: 'HARD', status: 'ACTIVE', hardBlockAt: { gte: mtdStart }, paymentMode: 'FINANCE' },
    }),
    prisma.blockingRequest.count({
      where: { branchId: { in: branchIds }, blockType: 'HARD', status: 'EXPIRED', hardBlockAt: { gte: mtdStart } },
    }),
  ]);

  res.json({ mtdBlocked, mtdCash, mtdFinance, mtdReleased });
});

// ── Branch × Stock Status pivot ───────────────────────────────────────────────
router.get('/branch-stock', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const codes = CLUSTER_BRANCHES[clusterNumber] ?? [];
  const branches = await prisma.branch.findMany({
    where: { branchCode: { in: codes } },
    select: { id: true, name: true, branchCode: true },
  });
  const branchIds = branches.map((b) => b.id);

  if (!branchIds.length) { res.json([]); return; }

  const blockings = await prisma.blockingRequest.findMany({
    where: { branchId: { in: branchIds }, blockType: 'HARD', status: 'ACTIVE' },
    select: {
      branchId: true,
      vehicle: { select: { stockStatus: true } },
    },
  });

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const map = new Map<string, number>();

  for (const b of blockings) {
    const branch = branchMap.get(b.branchId) ?? b.branchId;
    const stock = b.vehicle.stockStatus ?? 'Unknown';
    const key = `${branch}\x01${stock}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { branch: string; stockStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), stockStatus: key.slice(sep + 1), count });
  }

  res.json(rows);
});

// ── Branch × Payment Status pivot ────────────────────────────────────────────
router.get('/branch-payment', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const codes = CLUSTER_BRANCHES[clusterNumber] ?? [];
  const branches = await prisma.branch.findMany({
    where: { branchCode: { in: codes } },
    select: { id: true, name: true },
  });
  const branchIds = branches.map((b) => b.id);

  if (!branchIds.length) { res.json([]); return; }

  const blockings = await prisma.blockingRequest.findMany({
    where: { branchId: { in: branchIds }, blockType: 'HARD', status: 'ACTIVE' },
    select: { branchId: true, paymentStatus: true },
  });

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const map = new Map<string, number>();

  for (const b of blockings) {
    const branch = branchMap.get(b.branchId) ?? b.branchId;
    const status = b.paymentStatus ?? 'Not Updated';
    const key = `${branch}\x01${status}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const rows: { branch: string; paymentStatus: string; count: number }[] = [];
  for (const [key, count] of map) {
    const sep = key.indexOf('\x01');
    rows.push({ branch: key.slice(0, sep), paymentStatus: key.slice(sep + 1), count });
  }

  res.json(rows);
});

// ── Branch × Ageing pivot ─────────────────────────────────────────────────────
router.get('/branch-ageing', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const codes = CLUSTER_BRANCHES[clusterNumber] ?? [];
  const branches = await prisma.branch.findMany({
    where: { branchCode: { in: codes } },
    select: { id: true, name: true },
  });
  const branchIds = branches.map((b) => b.id);

  if (!branchIds.length) { res.json([]); return; }

  const blockings = await prisma.blockingRequest.findMany({
    where: { branchId: { in: branchIds }, blockType: 'HARD', status: 'ACTIVE' },
    select: { branchId: true, hardBlockAt: true },
  });

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const now = new Date();
  const map = new Map<string, number>();

  const ageBucket = (days: number): string => {
    if (days <= 7)  return '0–7 days';
    if (days <= 15) return '8–15 days';
    if (days <= 30) return '16–30 days';
    return '31+ days';
  };

  for (const b of blockings) {
    const branch = branchMap.get(b.branchId) ?? b.branchId;
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

// ── Finance KPI Summary ────────────────────────────────────────────────────────
router.get('/finance-summary', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const branchIds = await getClusterBranchIds(clusterNumber);

  const baseWhere = { blockType: 'HARD' as const, status: 'ACTIVE' as const, branchId: { in: branchIds } };
  const finWhere = { blockingRequest: baseWhere };

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
    prisma.blockingRequest.count({ where: baseWhere }),
    prisma.blockingRequest.count({ where: { ...baseWhere, financeRecord: null } }),
    prisma.financeRecord.count({ where: { ...finWhere, purchaseMode: 'In House' } }),
    prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Login Pending' } }),
    prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Logged Approval Pending' } }),
    prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Logged Document Pending' } }),
    prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Approved' } }),
    prisma.financeRecord.count({ where: { ...finWhere, financeStatus: 'Disbursed' } }),
  ]);

  res.json({ totalBlockings, untouched, inHouse, loginPending, loggedApprovalPending, loggedDocsPending, approved, disbursed });
});

// ── Finance Branch × Purchase Mode pivot ──────────────────────────────────────
router.get('/finance-branch-purchase', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const branchIds = await getClusterBranchIds(clusterNumber);
  if (!branchIds.length) { res.json([]); return; }

  const baseWhere = { blockType: 'HARD' as const, status: 'ACTIVE' as const, branchId: { in: branchIds } };

  const [records, blockings] = await Promise.all([
    prisma.financeRecord.findMany({
      where: { blockingRequest: baseWhere },
      select: {
        purchaseMode: true,
        blockingRequest: { select: { branch: { select: { name: true } } } },
      },
    }),
    prisma.blockingRequest.findMany({
      where: baseWhere,
      select: { id: true, branch: { select: { name: true } }, financeRecord: { select: { id: true } } },
    }),
  ]);

  const map = new Map<string, number>();

  for (const r of records) {
    const branch = r.blockingRequest.branch.name;
    const mode = r.purchaseMode ?? 'Not Set';
    const key = `${branch}\x01${mode}`;
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

// ── Full Payment Ageing (BND/CTDMS physical stock, cluster branches) ─────────
router.get('/full-payment-ageing', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const codes = CLUSTER_BRANCHES[clusterNumber] ?? [];
  const branches = await prisma.branch.findMany({
    where: { branchCode: { in: codes } },
    select: { id: true, name: true },
  });
  const branchIds = branches.map((b) => b.id);
  if (!branchIds.length) { res.json([]); return; }

  const blockings = await prisma.blockingRequest.findMany({
    where: {
      branchId: { in: branchIds },
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

// ── Ageing Stock — Physical BND/CTDMS (model × age bucket, OPEN + BLOCKED, all stock) ─
const STOCK_AGE_BUCKETS_CM = ['<30d', '30-50d', '51-70d', '71-100d', '101-150d', '150+d'] as const;
function stockAgeBucketCM(days: number): string {
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
    const bucket = stockAgeBucketCM(days);
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

// ── Active Blockings Ageing — cluster branches only (model × age bucket) ──────
router.get('/blocking-stock-ageing', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const branchIds = await getClusterBranchIds(clusterNumber);
  if (!branchIds.length) { res.json([]); return; }

  const blockings = await prisma.blockingRequest.findMany({
    where: {
      branchId: { in: branchIds },
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
    const bucket = stockAgeBucketCM(days);
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

// ── Raw blocking data (all cluster branches) ──────────────────────────────────
router.get('/all-blockings', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const branchIds = await getClusterBranchIds(clusterNumber);
  if (!branchIds.length) { res.json([]); return; }

  const blockings = await prisma.blockingRequest.findMany({
    where: { branchId: { in: branchIds }, blockType: 'HARD', status: 'ACTIVE' },
    orderBy: { hardBlockAt: 'desc' },
    include: {
      vehicle: { select: { model: true, suffix: true, colour: true, chassisYear: true, chassisNumber: true, stockStatus: true, stockyardLocation: true } },
      branch: { select: { name: true, branchCode: true } },
      user: { select: { fullName: true } },
      financeRecord: true,
    },
  });

  res.json(blockings);
});

// ── Finance Branch × Finance Status pivot ─────────────────────────────────────
router.get('/finance-branch-status', async (req: AuthRequest, res: Response) => {
  const clusterNumber = req.user!.clusterNumber;
  if (!clusterNumber) { res.status(403).json({ error: 'No cluster assigned' }); return; }

  const branchIds = await getClusterBranchIds(clusterNumber);
  if (!branchIds.length) { res.json([]); return; }

  const records = await prisma.financeRecord.findMany({
    where: { blockingRequest: { blockType: 'HARD', status: 'ACTIVE', branchId: { in: branchIds } }, purchaseMode: 'In House' },
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
