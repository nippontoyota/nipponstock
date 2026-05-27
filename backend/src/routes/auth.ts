import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { comparePassword } from '../lib/password';
import { signToken } from '../lib/jwt';

const router = Router();

const LoginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { loginId, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { loginId } });
  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    branchId: user.branchId,
    clusterNumber: user.clusterNumber ?? null,
  });
  res.json({
    token,
    user: {
      id: user.id,
      loginId: user.loginId,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
      clusterNumber: user.clusterNumber ?? null,
    },
  });
});

export default router;
