import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { hashPassword } from '../lib/password';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, loginId: true, fullName: true, role: true, branchId: true, clusterNumber: true, isActive: true, createdAt: true, branch: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

const CreateSchema = z.object({
  loginId: z.string().min(3),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['ADMIN', 'SALES_MANAGER', 'FINANCE_OFFICER', 'FINANCE_HEAD', 'CLUSTER_MANAGER']),
  branchId: z.string().uuid().optional(),
  clusterNumber: z.number().int().min(1).max(4).optional(),
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { password, ...rest } = parsed.data;
  const passwordHash = await hashPassword(password);
  try {
    const user = await prisma.user.create({
      data: { ...rest, passwordHash },
      select: { id: true, loginId: true, fullName: true, role: true, branchId: true, clusterNumber: true },
    });
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: 'Login ID already exists' });
  }
});

const UpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  branchId: z.string().uuid().nullable().optional(),
  clusterNumber: z.number().int().min(1).max(4).nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { password, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (password) data.passwordHash = await hashPassword(password);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, loginId: true, fullName: true, role: true, branchId: true, clusterNumber: true, isActive: true },
  });
  res.json(user);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

export default router;
