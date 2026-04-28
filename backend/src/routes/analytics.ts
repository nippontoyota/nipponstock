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

export default router;
