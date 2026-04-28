import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/models', async (_req: AuthRequest, res: Response) => {
  const configs = await prisma.modelConfig.findMany({ orderBy: { modelName: 'asc' } });
  res.json(configs);
});

router.put('/models/:model', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ blockingDurationDays: z.number().int().min(1) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const config = await prisma.modelConfig.upsert({
    where: { modelName: req.params.model },
    update: { blockingDurationDays: parsed.data.blockingDurationDays, updatedById: req.user!.userId },
    create: { modelName: req.params.model, blockingDurationDays: parsed.data.blockingDurationDays, updatedById: req.user!.userId },
  });

  await logAudit({ entityType: 'CONFIG', entityId: config.id, action: 'MODEL_CONFIG_UPDATED', performedById: req.user!.userId, newValue: { model: req.params.model, days: parsed.data.blockingDurationDays } });
  res.json(config);
});

router.get('/global', async (_req: AuthRequest, res: Response) => {
  const config = await prisma.globalConfig.findUnique({ where: { key: 'default_blocking_days' } });
  res.json({ defaultDays: config ? parseInt(config.value) : 7 });
});

router.put('/global', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ defaultDays: z.number().int().min(1) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const config = await prisma.globalConfig.upsert({
    where: { key: 'default_blocking_days' },
    update: { value: String(parsed.data.defaultDays), updatedById: req.user!.userId },
    create: { key: 'default_blocking_days', value: String(parsed.data.defaultDays), updatedById: req.user!.userId },
  });

  await logAudit({ entityType: 'CONFIG', entityId: config.id, action: 'GLOBAL_CONFIG_UPDATED', performedById: req.user!.userId, newValue: { defaultDays: parsed.data.defaultDays } });
  res.json({ defaultDays: parseInt(config.value) });
});

export default router;
