import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: AuthRequest, res: Response) => {
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
  res.json(branches);
});

const BranchSchema = z.object({
  name: z.string().min(1),
  branchCode: z.string().min(1),
  location: z.string().min(1),
});

router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = BranchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  try {
    const branch = await prisma.branch.create({ data: parsed.data });
    res.status(201).json(branch);
  } catch {
    res.status(409).json({ error: 'Branch code already exists' });
  }
});

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  branchCode: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
});

router.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  try {
    const branch = await prisma.branch.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(branch);
  } catch {
    res.status(404).json({ error: 'Branch not found or code conflict' });
  }
});

router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  await prisma.branch.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
