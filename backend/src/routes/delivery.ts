import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Disk storage for delivery documents
const uploadDir = path.join(process.cwd(), 'uploads', 'delivery');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const DELIVERY_ROLES = ['DELIVERY_INCHARGE', 'INSURANCE', 'ACCOUNTS_DEPT', 'ADMIN'];

function requireDeliveryRole(req: AuthRequest, res: Response, next: () => void) {
  if (!req.user || !DELIVERY_ROLES.includes(req.user.role)) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  next();
}

// GET /delivery/full-payment-ready  — Full Payment blockings not yet in workflow
router.get('/full-payment-ready', requireDeliveryRole, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'DELIVERY_INCHARGE' && req.user!.role !== 'ADMIN') {
    res.status(403).json({ error: 'Delivery Incharge only' }); return;
  }
  const branchId = req.user!.branchId;
  if (!branchId && req.user!.role !== 'ADMIN') {
    res.status(403).json({ error: 'No branch assigned' }); return;
  }

  const where: Record<string, unknown> = {
    blockType: 'HARD',
    status: 'ACTIVE',
    paymentStatus: 'Full Payment Received',
    deliveryWorkflow: null,
  };
  if (branchId) where.branchId = branchId;

  const blockings = await prisma.blockingRequest.findMany({
    where,
    orderBy: { fullPaymentAt: 'desc' },
    include: {
      vehicle: { select: { chassisNumber: true, model: true, suffix: true, colour: true, chassisYear: true } },
      user: { select: { fullName: true } },
    },
  });
  res.json(blockings);
});

// GET /delivery/cases  — active workflow cases for current role
router.get('/cases', requireDeliveryRole, async (req: AuthRequest, res: Response) => {
  const { role, branchId } = req.user!;

  const stageMaps: Record<string, string[]> = {
    DELIVERY_INCHARGE: ['DI_DOCUMENTS', 'DI_VAHAAN_ENTRY', 'DI_VAHAAN_DONE'],
    INSURANCE: ['INSURANCE'],
    ACCOUNTS_DEPT: ['ACCOUNTS_TALLY', 'ACCOUNTS_ROAD_TAX'],
  };

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  if (role !== 'ADMIN') where.stage = { in: stageMaps[role] ?? [] };

  const workflows = await prisma.deliveryWorkflow.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      blocking: {
        include: {
          vehicle: { select: { chassisNumber: true, model: true, suffix: true, colour: true, chassisYear: true } },
          user: { select: { fullName: true } },
        },
      },
      branch: { select: { name: true, branchCode: true } },
    },
  });
  res.json(workflows);
});

// GET /delivery/:id  — single workflow
router.get('/:id', requireDeliveryRole, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const wf = await prisma.deliveryWorkflow.findUnique({
    where: { id },
    include: {
      blocking: {
        include: {
          vehicle: { select: { chassisNumber: true, model: true, suffix: true, colour: true, chassisYear: true } },
          user: { select: { fullName: true } },
          financeRecord: true,
        },
      },
      branch: { select: { name: true, branchCode: true } },
    },
  });
  if (!wf) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(wf);
});

// POST /delivery/:blockingId/init  — DI starts workflow
router.post('/:blockingId/init', async (req: AuthRequest, res: Response) => {
  const { role, branchId } = req.user!;
  if (role !== 'DELIVERY_INCHARGE' && role !== 'ADMIN') {
    res.status(403).json({ error: 'Delivery Incharge only' }); return;
  }
  if (!branchId && role !== 'ADMIN') {
    res.status(403).json({ error: 'No branch assigned' }); return;
  }

  const blocking = await prisma.blockingRequest.findUnique({
    where: { id: req.params.blockingId },
    include: { deliveryWorkflow: true },
  });
  if (!blocking) { res.status(404).json({ error: 'Blocking not found' }); return; }
  if (branchId && blocking.branchId !== branchId) {
    res.status(403).json({ error: 'Not your branch' }); return;
  }
  if (blocking.paymentStatus !== 'Full Payment Received') {
    res.status(400).json({ error: 'Only Full Payment Received blockings can start delivery' }); return;
  }
  if (blocking.deliveryWorkflow) {
    res.json(blocking.deliveryWorkflow); return;
  }

  const wf = await prisma.deliveryWorkflow.create({
    data: {
      blockingId: blocking.id,
      branchId: blocking.branchId,
      stage: 'DI_DOCUMENTS',
      customerName: blocking.customerName ?? undefined,
      teamLeaderName: blocking.teamLeaderName ?? undefined,
      salesOfficer: blocking.consultantName ?? undefined,
    },
  });
  res.json(wf);
});

const STAGE_ORDER = [
  'DI_DOCUMENTS',
  'INSURANCE',
  'DI_VAHAAN_ENTRY',
  'ACCOUNTS_TALLY',
  'DI_VAHAAN_DONE',
  'ACCOUNTS_ROAD_TAX',
  'COMPLETED',
] as const;

const STAGE_ROLE_MAP: Record<string, string> = {
  DI_DOCUMENTS:    'DELIVERY_INCHARGE',
  INSURANCE:       'INSURANCE',
  DI_VAHAAN_ENTRY: 'DELIVERY_INCHARGE',
  ACCOUNTS_TALLY:  'ACCOUNTS_DEPT',
  DI_VAHAAN_DONE:  'DELIVERY_INCHARGE',
  ACCOUNTS_ROAD_TAX: 'ACCOUNTS_DEPT',
};

const updateSchema = z.object({
  customerName:    z.string().optional(),
  salesOfficer:    z.string().optional(),
  teamLeaderName:  z.string().optional(),
  insuranceType:   z.string().optional(),
  insuranceCompany:z.string().optional(),
  payout:          z.number().optional(),
  premium:         z.number().optional(),
  insuranceRemarks:z.string().optional(),
  tallyNo:         z.string().optional(),
  tallyDate:       z.string().optional(),
  vaahanDone:      z.boolean().optional(),
  roadTaxReceiptNo:z.string().optional(),
}).passthrough();

// PATCH /delivery/:id  — save + advance stage
router.patch('/:id', requireDeliveryRole, async (req: AuthRequest, res: Response) => {
  const { role, branchId } = req.user!;
  const wf = await prisma.deliveryWorkflow.findUnique({ where: { id: req.params.id } });
  if (!wf) { res.status(404).json({ error: 'Not found' }); return; }
  if (branchId && wf.branchId !== branchId) {
    res.status(403).json({ error: 'Not your branch' }); return;
  }

  const allowed = STAGE_ROLE_MAP[wf.stage];
  if (role !== 'ADMIN' && role !== allowed) {
    res.status(403).json({ error: `This stage belongs to ${allowed}` }); return;
  }

  const body = updateSchema.parse(req.body);

  // Advance to next stage
  const idx = STAGE_ORDER.indexOf(wf.stage as typeof STAGE_ORDER[number]);
  const nextStage = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : wf.stage;

  const data: Record<string, unknown> = { ...body, stage: nextStage };
  if (typeof body.tallyDate === 'string' && body.tallyDate) {
    data.tallyDate = new Date(body.tallyDate);
  }

  const updated = await prisma.deliveryWorkflow.update({ where: { id: req.params.id }, data });
  res.json(updated);
});

// POST /delivery/:id/upload/:field  — upload a document
router.post('/:id/upload/:field', requireDeliveryRole, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const ALLOWED_FIELDS = ['panCardUrl', 'aadharUrl', 'fileFrontUrl', 'fileBackUrl', 'form21Url'];
  const { field } = req.params;
  if (!ALLOWED_FIELDS.includes(field)) {
    res.status(400).json({ error: 'Invalid field' }); return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' }); return;
  }

  const url = `/uploads/delivery/${req.file.filename}`;
  const updated = await prisma.deliveryWorkflow.update({
    where: { id: req.params.id },
    data: { [field]: url },
  });
  res.json({ url, workflow: updated });
});

export default router;
