import { Router, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { getHeatmap } from '../services/heatmap';

const router = Router();
router.use(authenticate);

// Heatmap — available to all authenticated users
router.get('/heatmap', async (req: AuthRequest, res: Response) => {
  const year = req.query.year ? parseInt(req.query.year as string) : undefined;
  const data = await getHeatmap(year);
  res.json(data);
});

// Distinct chassis years in active stock — available to all authenticated users
router.get('/years', async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.vehicle.findMany({
    where: { status: { not: 'DELIVERED' }, hiddenFromHeatmap: false },
    select: { chassisYear: true },
    distinct: ['chassisYear'],
    orderBy: { chassisYear: 'desc' },
  });
  res.json(rows.map((r) => r.chassisYear));
});

// All stock — admin only
router.get('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { status, model, page = '1', limit = '50' } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (model) where.model = { contains: model, mode: 'insensitive' };

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        blockings: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { user: { select: { fullName: true } }, branch: { select: { name: true } } },
        },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);
  res.json({ vehicles, total, page: parseInt(page), limit: parseInt(limit) });
});

// Import stock
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/import', requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const RowSchema = z.object({
    chassisNumber: z.string().min(1),
    chassisYear: z.coerce.number().int(),
    model: z.string().min(1),
    suffix: z.string().min(1),
    colour: z.string().min(1),
    stockyardLocation: z.string().min(1),
    dateOfArrival: z.coerce.date(),
  });

  let success = 0;
  const rejected: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    // normalise header keys (case-insensitive, strip spaces)
    const normalised: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = k.replace(/\s+/g, '').replace(/^(.)/, (c) => c.toLowerCase());
      // Trim string values to remove trailing spaces from Excel cells
      normalised[key] = typeof v === 'string' ? v.trim() : v;
    }

    const parsed = RowSchema.safeParse(normalised);
    if (!parsed.success) {
      rejected.push({ row: i + 2, reason: JSON.stringify(parsed.error.flatten().fieldErrors) });
      continue;
    }

    try {
      await prisma.vehicle.upsert({
        where: { chassisNumber: parsed.data.chassisNumber },
        update: { ...parsed.data },
        create: { ...parsed.data, status: 'OPEN' },
      });
      success++;
    } catch (e) {
      rejected.push({ row: i + 2, reason: String(e) });
    }
  }

  res.json({ total: rows.length, success, rejected });
});

// Manual single-vehicle entry
const ManualVehicleSchema = z.object({
  stockStatus: z.enum(['BND', 'MDDP', 'CTDMS']),
  bndReportedMonth: z.coerce.date().optional().nullable(),
  chassisYear: z.coerce.number().int().min(1990).max(2100),
  model: z.string().min(1),
  suffix: z.string().min(1),
  colour: z.string().min(1),
  chassisNumber: z.string().min(1),
  modelDisc: z.string().optional().nullable(),
  assignmentDate: z.coerce.date().optional().nullable(),
  yardOut: z.coerce.date().optional().nullable(),
  physicalStockBranchId: z.string().uuid().optional().nullable(),
  stockyardLocation: z.string().optional().default(''),
  dateOfArrival: z.coerce.date().optional(),
});

router.post('/manual', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = ManualVehicleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        ...parsed.data,
        status: 'OPEN',
        dateOfArrival: parsed.data.dateOfArrival ?? new Date(),
      },
    });
    res.status(201).json(vehicle);
  } catch {
    res.status(409).json({ error: 'Chassis number already exists' });
  }
});

// Export stock
router.get('/export', requireAdmin, async (_req: AuthRequest, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      blockings: {
        where: { status: 'ACTIVE' },
        take: 1,
        include: { user: { select: { fullName: true } }, branch: { select: { name: true } } },
      },
    },
  });

  const rows = vehicles.map((v) => ({
    chassisNumber: v.chassisNumber,
    chassisYear: v.chassisYear,
    model: v.model,
    suffix: v.suffix,
    colour: v.colour,
    stockyardLocation: v.stockyardLocation,
    dateOfArrival: v.dateOfArrival.toISOString().split('T')[0],
    status: v.status,
    blockedBy: v.blockings[0]?.user.fullName ?? '',
    branch: v.blockings[0]?.branch.name ?? '',
    expiryAt: v.blockings[0]?.expiryAt?.toISOString() ?? '',
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Stock');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="stock_export.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Upload CTDMS stock — converts matching MDDP vehicles to CTDMS
// Matching is by model + suffix + colour (no primary key between MDDP and CTDMS)
// Priority: MDDP vehicles with earliest active blocking are converted first
router.post('/upload-ctdms', requireAdmin, upload.single('file'), async (_req: AuthRequest, res: Response) => {
  if (!_req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  const wb = XLSX.read(_req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  let converted = 0;
  let notFound = 0;
  const details: { row: number; status: string; model?: string; suffix?: string; colour?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    // Normalise header keys
    const raw = rows[i];
    const norm: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      norm[k.replace(/\s+/g, '').replace(/^(.)/, (c) => c.toLowerCase())] = v;
    }

    const model  = String(norm.model  ?? '').trim();
    const suffix = String(norm.suffix ?? '').trim();
    const colour = String(norm.colour ?? '').trim();
    if (!model || !suffix || !colour) { details.push({ row: i + 2, status: 'skipped — missing fields' }); continue; }

    // Find MDDP vehicles matching model/suffix/colour, with their active blockings
    const mddpVehicles = await prisma.vehicle.findMany({
      where: { model, suffix, colour, stockStatus: 'MDDP' },
      include: {
        blockings: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { dateOfArrival: 'asc' },
    });

    // Sort: vehicles with active blockings first (earliest booking first), then by arrival date
    const sorted = [...mddpVehicles].sort((a, b) => {
      const aB = a.blockings[0];
      const bB = b.blockings[0];
      if (aB && !bB) return -1;
      if (!aB && bB) return 1;
      if (aB && bB) return new Date(aB.createdAt).getTime() - new Date(bB.createdAt).getTime();
      return 0;
    });

    if (sorted.length === 0) {
      details.push({ row: i + 2, status: 'no matching MDDP found', model, suffix, colour });
      notFound++;
    } else {
      await prisma.vehicle.update({ where: { id: sorted[0].id }, data: { stockStatus: 'CTDMS' } });
      details.push({ row: i + 2, status: 'converted MDDP → CTDMS', model, suffix, colour });
      converted++;
    }
  }

  res.json({ total: rows.length, converted, notFound, details });
});

// Toggle heatmap visibility — admin only
router.patch('/:id/toggle-visibility', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id }, select: { hiddenFromHeatmap: true } });
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return; }
    const updated = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { hiddenFromHeatmap: !vehicle.hiddenFromHeatmap },
    });
    res.json({ id: updated.id, hiddenFromHeatmap: updated.hiddenFromHeatmap });
  } catch {
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});

export default router;
