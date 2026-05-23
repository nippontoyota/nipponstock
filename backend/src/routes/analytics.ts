import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/summary', async (_req: AuthRequest, res: Response) => {
  const [total, open, softBlocked, hardBlocked, delivered, expired] = await Promise.all([
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { status: 'OPEN' } }),
    prisma.vehicle.count({ where: { status: 'SOFT_BLOCKED' } }),
    prisma.vehicle.count({ where: { status: 'HARD_BLOCKED' } }),
    prisma.vehicle.count({ where: { status: 'DELIVERED' } }),
    prisma.blockingRequest.count({ where: { status: 'EXPIRED' } }),
  ]);
  res.json({ total, open, softBlocked, hardBlocked, delivered, expired });
});

router.get('/daywise', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as Record<string, string>;
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(to) : new Date();

  const blockings = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', expiryAt: { gte: fromDate, lte: toDate } },
    select: { expiryAt: true, status: true },
  });

  const dayMap = new Map<string, { pending: number; expiring: number }>();
  for (const b of blockings) {
    if (!b.expiryAt) continue;
    const day = b.expiryAt.toISOString().split('T')[0];
    const entry = dayMap.get(day) ?? { pending: 0, expiring: 0 };
    if (b.status === 'ACTIVE') entry.pending++;
    else entry.expiring++;
    dayMap.set(day, entry);
  }

  const result = Array.from(dayMap.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json(result);
});

router.get('/branchwise', async (_req: AuthRequest, res: Response) => {
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });

  const data = await Promise.all(
    branches.map(async (branch) => {
      const [active, delivered, expired] = await Promise.all([
        prisma.blockingRequest.count({ where: { branchId: branch.id, status: 'ACTIVE', blockType: 'HARD' } }),
        prisma.blockingRequest.count({ where: { branchId: branch.id, status: 'DELIVERED' } }),
        prisma.blockingRequest.count({ where: { branchId: branch.id, status: 'EXPIRED' } }),
      ]);
      const total = active + delivered + expired;
      const conversionRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
      return { branch: branch.name, active, delivered, expired, conversionRate };
    })
  );

  res.json(data);
});

router.get('/modelwise', async (_req: AuthRequest, res: Response) => {
  const models = await prisma.vehicle.findMany({
    select: { model: true },
    distinct: ['model'],
  });

  const data = await Promise.all(
    models.map(async ({ model }) => {
      const [active, delivered, expired] = await Promise.all([
        prisma.blockingRequest.count({ where: { vehicle: { model }, status: 'ACTIVE', blockType: 'HARD' } }),
        prisma.blockingRequest.count({ where: { vehicle: { model }, status: 'DELIVERED' } }),
        prisma.blockingRequest.count({ where: { vehicle: { model }, status: 'EXPIRED' } }),
      ]);
      const total = active + delivered + expired;
      const conversionRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
      return { model, active, delivered, expired, conversionRate };
    })
  );

  res.json(data);
});

// Dashboard reports — 4 pivot tables
router.get('/dashboard-reports', async (_req: AuthRequest, res: Response) => {
  const now = new Date();

  const [physicalVehicles, blockingStockRaw, blockingPaymentRaw, ageingRaw] = await Promise.all([
    // 1. Physical stock: non-delivered BND/CTDMS vehicles
    prisma.vehicle.findMany({
      where: { status: { not: 'DELIVERED' }, stockStatus: { in: ['BND', 'CTDMS'] } },
      select: { model: true, stockStatus: true, chassisYear: true },
    }),
    // 2. Active hard blockings → stock status breakdown
    prisma.blockingRequest.findMany({
      where: { status: 'ACTIVE', blockType: 'HARD' },
      select: { vehicle: { select: { model: true, stockStatus: true, chassisYear: true } } },
    }),
    // 3. Active hard blockings → payment status breakdown
    prisma.blockingRequest.findMany({
      where: { status: 'ACTIVE', blockType: 'HARD' },
      select: { vehicle: { select: { model: true } }, paymentStatus: true },
    }),
    // 4. Active hard blockings → ageing by branch
    prisma.blockingRequest.findMany({
      where: { status: 'ACTIVE', blockType: 'HARD', hardBlockAt: { not: null } },
      select: { hardBlockAt: true, branch: { select: { name: true } } },
    }),
  ]);

  // 1. Physical Stock
  const physMap = new Map<string, number>();
  for (const v of physicalVehicles) {
    const k = `${v.model}\x01${v.stockStatus}\x01${v.chassisYear}`;
    physMap.set(k, (physMap.get(k) ?? 0) + 1);
  }
  const physicalStock = Array.from(physMap.entries()).map(([k, count]) => {
    const [model, stockStatus, year] = k.split('\x01');
    return { model, stockStatus, chassisYear: parseInt(year), count };
  });

  // 2. Blocking by Stock Status
  const bsMap = new Map<string, number>();
  for (const b of blockingStockRaw) {
    const { model, stockStatus, chassisYear } = b.vehicle;
    const k = `${model}\x01${stockStatus ?? 'UNKNOWN'}\x01${chassisYear}`;
    bsMap.set(k, (bsMap.get(k) ?? 0) + 1);
  }
  const blockingByStock = Array.from(bsMap.entries()).map(([k, count]) => {
    const [model, stockStatus, year] = k.split('\x01');
    return { model, stockStatus, chassisYear: parseInt(year), count };
  });

  // 3. Blocking by Payment Status
  const bpMap = new Map<string, number>();
  for (const b of blockingPaymentRaw) {
    const k = `${b.vehicle.model}\x01${b.paymentStatus ?? 'Not Set'}`;
    bpMap.set(k, (bpMap.get(k) ?? 0) + 1);
  }
  const blockingByPayment = Array.from(bpMap.entries()).map(([k, count]) => {
    const sep = k.indexOf('\x01');
    return { model: k.slice(0, sep), paymentStatus: k.slice(sep + 1), count };
  });

  // 4. Ageing by Branch
  const ageBucket = (days: number) => {
    if (days <= 7)  return '1-7';
    if (days <= 14) return '8-14';
    if (days <= 29) return '15-29';
    if (days <= 39) return '30-39';
    return '40+';
  };
  const agMap = new Map<string, number>();
  for (const b of ageingRaw) {
    if (!b.hardBlockAt) continue;
    const days = Math.floor((now.getTime() - new Date(b.hardBlockAt).getTime()) / 86400000);
    const bucket = ageBucket(Math.max(0, days));
    const k = `${b.branch.name}\x01${bucket}`;
    agMap.set(k, (agMap.get(k) ?? 0) + 1);
  }
  const ageing = Array.from(agMap.entries()).map(([k, count]) => {
    const sep = k.indexOf('\x01');
    return { branch: k.slice(0, sep), bucket: k.slice(sep + 1), count };
  });

  res.json({ physicalStock, blockingByStock, blockingByPayment, ageing });
});

export default router;
