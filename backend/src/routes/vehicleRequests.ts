import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const CreateSchema = z.object({
  model: z.string().min(1),
  suffix: z.string().min(1),
  colour: z.string().min(1),
  notes: z.string().optional(),
});

// POST /vehicle-requests — sales manager submits a request
router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const userId = req.user!.userId;
  const branchId = req.user!.branchId;
  if (!branchId) { res.status(403).json({ error: 'Only sales managers can submit vehicle requests' }); return; }

  try {
    const request = await prisma.vehicleRequest.create({
      data: { ...parsed.data, userId, branchId },
      include: { user: { select: { fullName: true } }, branch: { select: { name: true } } },
    });
    res.status(201).json(request);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit request', detail: String(e) });
  }
});

// GET /vehicle-requests — admin views all requests
router.get('/', requireAdmin, async (_req: AuthRequest, res: Response) => {
  const requests = await prisma.vehicleRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { fullName: true, loginId: true } },
      branch: { select: { name: true } },
    },
  });
  res.json(requests);
});

// PATCH /vehicle-requests/:id — admin updates status
router.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { status } = req.body as { status: string };
  if (!status) { res.status(400).json({ error: 'status required' }); return; }
  try {
    const updated = await prisma.vehicleRequest.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: 'Request not found' });
  }
});

export default router;
