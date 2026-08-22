import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { getHeatmap } from '../services/heatmap';

const router = Router();

function syncSecretOk(req: Request): boolean {
  const secret = process.env.LOCATION_SYNC_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  const token = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return token.length === expected.length && crypto.timingSafeEqual(token, expected);
}

const SyncLocationsSchema = z.object({
  updates: z
    .array(
      z.object({
        chassisNumber: z.string().min(1),
        stockyardLocation: z.string(),
      }),
    )
    .max(5000),
});

// Machine sync from stockyard — before JWT so a shared secret works.
router.post('/sync-locations', async (req: Request, res: Response) => {
  if (!process.env.LOCATION_SYNC_SECRET) {
    res.status(503).json({ error: 'LOCATION_SYNC_SECRET not configured' });
    return;
  }
  if (!syncSecretOk(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = SyncLocationsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // Dedupe by chassis (last wins); normalize case for match.
  const byChassis = new Map<string, string>();
  for (const u of parsed.data.updates) {
    byChassis.set(u.chassisNumber.trim().toUpperCase(), u.stockyardLocation);
  }

  let updated = 0;
  let notFound = 0;
  for (const [chassisNumber, stockyardLocation] of byChassis) {
    const result = await prisma.vehicle.updateMany({
      where: { chassisNumber: { equals: chassisNumber, mode: 'insensitive' } },
      data: { stockyardLocation },
    });
    if (result.count > 0) updated += result.count;
    else notFound += 1;
  }

  res.json({ total: byChassis.size, updated, notFound });
});

router.use(authenticate);

// Heatmap — available to all authenticated users
router.get('/heatmap', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const data = await getHeatmap(year);
    res.json(data);
  } catch (err) { next(err); }
});

// Distinct chassis years in active stock — available to all authenticated users
router.get('/years', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.vehicle.findMany({
      where: { status: { not: 'DELIVERED' }, hiddenFromHeatmap: false },
      select: { chassisYear: true },
      distinct: ['chassisYear'],
      orderBy: { chassisYear: 'desc' },
    });
    res.json(rows.map((r) => r.chassisYear));
  } catch (err) { next(err); }
});

// Open vehicles matching model/suffix/colour/year — available to all authenticated users (SO, sales, admin)
router.get('/open', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { model, suffix, colour, year } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { status: 'OPEN', hiddenFromHeatmap: false };
    if (model) where.model = model;
    if (suffix) where.suffix = suffix;
    if (colour) where.colour = colour;
    if (year) where.chassisYear = parseInt(year);
    const vehicles = await prisma.vehicle.findMany({
      where,
      select: { id: true, chassisNumber: true, model: true, suffix: true, colour: true, chassisYear: true, stockStatus: true },
      orderBy: { assignmentDate: 'asc' },
    });
    res.json(vehicles);
  } catch (err) { next(err); }
});

// All stock — admin only
router.get('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { status, model, chassis, stockStatus, page = '1', limit = '50' } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (model) where.model = { contains: model, mode: 'insensitive' };
  if (chassis) where.chassisNumber = { contains: chassis, mode: 'insensitive' };
  if (stockStatus) where.stockStatus = stockStatus;

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
    stockyardLocation: z.string().default(''),
    dateOfArrival: z.coerce.date(),
    stockStatus: z.enum(['BND', 'MDDP', 'CTDMS']).optional(),
  });

  let success = 0;
  let created = 0;
  let updated = 0;
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
      const existing = await prisma.vehicle.findUnique({
        where: { chassisNumber: parsed.data.chassisNumber },
        select: { id: true },
      });
      await prisma.vehicle.upsert({
        where: { chassisNumber: parsed.data.chassisNumber },
        update: { ...parsed.data },
        create: { ...parsed.data, status: 'OPEN' },
      });
      success++;
      if (existing) updated++; else created++;
    } catch (e) {
      rejected.push({ row: i + 2, reason: String(e) });
    }
  }

  res.json({ total: rows.length, success, created, updated, rejected });
});

// Import masked vehicles (INN / FRN / IMV) — chassis stays hidden from SM/TL until Full Payment
router.post('/import-masked', requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  const MASKED_MODELS = ['INN', 'FRN', 'IMV'];

  const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const RowSchema = z.object({
    chassisNumber: z.string().min(1),
    chassisYear: z.coerce.number().int(),
    model: z.string().min(1).refine((m) => MASKED_MODELS.includes(m.toUpperCase()), { message: 'Model must be INN, FRN, or IMV' }),
    suffix: z.string().min(1),
    colour: z.string().min(1),
    stockyardLocation: z.string().default(''),
    dateOfArrival: z.coerce.date(),
    stockStatus: z.enum(['BND', 'MDDP', 'CTDMS']).optional(),
  });

  let success = 0, created = 0, updated = 0;
  const rejected: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const normalised: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rows[i])) {
      const key = k.replace(/\s+/g, '').replace(/^(.)/, (c) => c.toLowerCase());
      normalised[key] = typeof v === 'string' ? v.trim() : v;
    }
    if (normalised.model && typeof normalised.model === 'string') {
      normalised.model = normalised.model.toUpperCase();
    }

    const parsed = RowSchema.safeParse(normalised);
    if (!parsed.success) {
      rejected.push({ row: i + 2, reason: JSON.stringify(parsed.error.flatten().fieldErrors) });
      continue;
    }

    try {
      const existing = await prisma.vehicle.findUnique({ where: { chassisNumber: parsed.data.chassisNumber }, select: { id: true } });
      await prisma.vehicle.upsert({
        where: { chassisNumber: parsed.data.chassisNumber },
        update: { ...parsed.data, hiddenFromHeatmap: false },
        create: { ...parsed.data, status: 'OPEN', hiddenFromHeatmap: false },
      });
      success++;
      if (existing) updated++; else created++;
    } catch (e) {
      rejected.push({ row: i + 2, reason: String(e) });
    }
  }

  res.json({ total: rows.length, success, created, updated, rejected });
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
    stockStatus: v.stockStatus ?? '',
    stockyardLocation: v.stockyardLocation,
    dateOfArrival: v.dateOfArrival.toISOString().split('T')[0],
    status: v.status,
    blockedBy: v.blockings[0]?.user.fullName ?? '',
    branch: v.blockings[0]?.branch.name ?? '',
    expiryAt: v.blockings[0]?.expiryAt?.toISOString() ?? '',
    hidden: v.hiddenFromHeatmap,
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

// Tally Done — bulk deliver vehicles from Tally export
// Accepts the standard Tally export with columns:
//   VIN NO. | TALLY Inv. No | TALLY Inv. Date | Dealer Code
//   (also works with generic: ChassisNumber | TallyInvoiceNo | TallyDoneBranch)
router.post('/tally-done', requireAdmin, upload.single('file'), async (_req: AuthRequest, res: Response) => {
  if (!_req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(_req.file.buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false });
  } catch (err) {
    res.status(400).json({ error: 'Could not parse Excel file', detail: String(err) });
    return;
  }

  let successful = 0;
  let notFound = 0;
  let noBlocking = 0;
  let branchMismatch = 0;

  interface TallyDetail {
    row: number;
    chassisNumber: string;
    status: 'success' | 'not_found' | 'no_blocking' | 'branch_mismatch' | 'skipped' | 'error';
    note?: string;
  }
  const details: TallyDetail[] = [];

  // Normalize key: strip non-alphanumeric chars, lowercase
  const nk = (k: string) => k.replace(/[^a-z0-9]/gi, '').toLowerCase();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const norm: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      norm[nk(k)] = typeof v === 'string' ? v.trim() : v;
    }

    // Column aliases: old format (ChassisNumber, Tally Invoice No, Tally Done branch)
    //                 new format (VIN NO., TALLY Inv. No, TALLY Inv. Date, Dealer Code)
    const chassisNumber = String(
      norm['chassisnumber'] ?? norm['vinno'] ?? norm['vin'] ?? ''
    ).trim().toUpperCase();

    const tallyInvoiceNo = String(
      norm['tallyinvoiceno'] ?? norm['tallyinvno'] ?? norm['tallyno'] ?? ''
    ).trim();

    const rawDate = norm['tallyinvdate'] ?? norm['tallydate'];
    let tallyDate: Date | null = null;
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      tallyDate = rawDate;
    } else if (typeof rawDate === 'string' && rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) tallyDate = parsed;
    }

    // Old format uses branch name; new format uses dealer code
    const tallyBranch = String(
      norm['tallydonebranch'] ?? norm['dealercode'] ?? norm['branch'] ?? ''
    ).trim().toUpperCase();

    if (!chassisNumber || chassisNumber === 'UNDEFINED') {
      details.push({ row: i + 2, chassisNumber: '', status: 'skipped', note: 'Missing chassis number' });
      continue;
    }

    try {
      const vehicle = await prisma.vehicle.findUnique({
        where: { chassisNumber },
        include: {
          blockings: {
            where: { status: { in: ['ACTIVE', 'DELIVERED'] } },
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
            take: 1,
            include: { branch: { select: { id: true, name: true, branchCode: true } } },
          },
        },
      });

      if (!vehicle) {
        details.push({ row: i + 2, chassisNumber, status: 'not_found' });
        notFound++;
        continue;
      }

      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'DELIVERED' } });

      const blocking = vehicle.blockings[0] ?? null;

      if (!blocking) {
        details.push({ row: i + 2, chassisNumber, status: 'no_blocking', note: 'Vehicle delivered — no active blocking found' });
        noBlocking++;
        continue;
      }

      await prisma.blockingRequest.update({
        where: { id: blocking.id },
        data: { status: 'DELIVERED', retailId: tallyInvoiceNo || null },
      });

      await prisma.deliveryWorkflow.upsert({
        where: { blockingId: blocking.id },
        create: {
          blockingId: blocking.id,
          branchId: blocking.branch.id,
          stage: 'ACCOUNTS_TALLY',
          tallyNo: tallyInvoiceNo || null,
          tallyDate: tallyDate ?? new Date(),
        },
        update: {
          tallyNo: tallyInvoiceNo || null,
          tallyDate: tallyDate ?? new Date(),
        },
      });

      const blockingBranchCode = (blocking.branch.branchCode ?? '').toUpperCase();
      const blockingBranchName = blocking.branch.name.toLowerCase();
      const tallyBranchLower   = tallyBranch.toLowerCase();
      const branchMatch = !tallyBranch ||
        blockingBranchCode === tallyBranch ||
        blockingBranchName.includes(tallyBranchLower) ||
        tallyBranchLower.includes(blockingBranchName);

      if (branchMatch) {
        successful++;
        details.push({ row: i + 2, chassisNumber, status: 'success', note: `Invoice: ${tallyInvoiceNo || '—'}` });
      } else {
        branchMismatch++;
        details.push({
          row: i + 2, chassisNumber, status: 'branch_mismatch',
          note: `Booking branch: ${blocking.branch.branchCode ?? blocking.branch.name} | Tally branch: ${tallyBranch}`,
        });
      }
    } catch (rowErr) {
      details.push({ row: i + 2, chassisNumber, status: 'error', note: String(rowErr) });
    }
  }

  res.json({ total: rows.length, successful, notFound, noBlocking, branchMismatch, details });
});

// CTDMS ↔ FEM — swap MDDP chassis with FEM chassis number and convert to CTDMS
// Excel columns: Chassis Number | New Chassis Number | Stockyard Location
router.post('/ctdms-fem', requireAdmin, upload.single('file'), async (_req: AuthRequest, res: Response) => {
  if (!_req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  const wb = XLSX.read(_req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  let successful = 0;
  let failed = 0;

  interface FemDetail {
    row: number;
    chassisNumber: string;
    status: 'success' | 'not_found' | 'wrong_status' | 'duplicate_chassis' | 'skipped';
    note?: string;
  }
  const details: FemDetail[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const norm: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      norm[k.replace(/\s+/g, '').replace(/^(.)/, (c) => c.toLowerCase())] = typeof v === 'string' ? v.trim() : v;
    }

    const chassisNumber     = String(norm.chassisNumber    ?? '').trim().toUpperCase();
    const newChassisNumber  = String(norm.newChassisNumber ?? '').trim().toUpperCase();
    const stockyardLocation = String(norm.stockyardLocation ?? '').trim();

    if (!chassisNumber || !newChassisNumber) {
      details.push({ row: i + 2, chassisNumber: chassisNumber || '—', status: 'skipped', note: 'Missing chassis number or new chassis number' });
      failed++;
      continue;
    }

    // Find the vehicle with its active blocking
    const vehicle = await prisma.vehicle.findUnique({
      where: { chassisNumber },
      include: {
        blockings: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!vehicle) {
      details.push({ row: i + 2, chassisNumber, status: 'not_found', note: 'Vehicle not found' });
      failed++;
      continue;
    }

    if (vehicle.stockStatus !== 'MDDP') {
      details.push({ row: i + 2, chassisNumber, status: 'wrong_status', note: `Stock status is ${vehicle.stockStatus ?? 'null'} — expected MDDP` });
      failed++;
      continue;
    }

    // Ensure new chassis number is not already taken
    const duplicate = await prisma.vehicle.findUnique({ where: { chassisNumber: newChassisNumber }, select: { id: true } });
    if (duplicate) {
      details.push({ row: i + 2, chassisNumber, status: 'duplicate_chassis', note: `New chassis ${newChassisNumber} already exists in system` });
      failed++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: {
            chassisNumber: newChassisNumber,
            stockStatus: 'CTDMS',
            ...(stockyardLocation ? { stockyardLocation } : {}),
          },
        });

        // Extend active blocking expiry to today + 10 days
        if (vehicle.blockings[0]) {
          const newExpiry = new Date();
          newExpiry.setDate(newExpiry.getDate() + 10);
          await tx.blockingRequest.update({
            where: { id: vehicle.blockings[0].id },
            data: { expiryAt: newExpiry },
          });
        }
      });

      const hasBlocking = !!vehicle.blockings[0];
      details.push({
        row: i + 2, chassisNumber, status: 'success',
        note: `→ ${newChassisNumber} · MDDP→CTDMS${hasBlocking ? ' · Expiry +10d' : ''}`,
      });
      successful++;
    } catch (e) {
      details.push({ row: i + 2, chassisNumber, status: 'skipped', note: String(e) });
      failed++;
    }
  }

  res.json({ total: rows.length, successful, failed, details });
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
