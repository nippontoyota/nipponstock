import { Router, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── CarModel ──────────────────────────────────────────────────────────────────

// GET all models with their suffixes and colours
router.get('/', async (_req: AuthRequest, res: Response) => {
  const models = await prisma.carModel.findMany({
    orderBy: { modelName: 'asc' },
    include: { suffixes: true, colours: true },
  });
  res.json(models);
});

const ModelSchema = z.object({
  modelCode: z.string().min(1),
  modelName: z.string().min(1),
  description: z.string().optional(),
});

router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = ModelSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  try {
    const model = await prisma.carModel.create({ data: parsed.data, include: { suffixes: true, colours: true } });
    res.status(201).json(model);
  } catch {
    res.status(409).json({ error: 'Model code already exists' });
  }
});

router.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = ModelSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  try {
    const model = await prisma.carModel.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { suffixes: true, colours: true },
    });
    res.json(model);
  } catch {
    res.status(404).json({ error: 'Model not found' });
  }
});

router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.carModel.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Model not found' });
  }
});

// ── CarSuffix ────────────────────────────────────────────────────────────────

const SuffixSchema = z.object({
  suffix: z.string().min(1),
  description: z.string().optional(),
});

router.post('/:modelId/suffixes', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = SuffixSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  try {
    const suffix = await prisma.carSuffix.create({
      data: { ...parsed.data, carModelId: req.params.modelId },
    });
    res.status(201).json(suffix);
  } catch {
    res.status(409).json({ error: 'Suffix already exists for this model' });
  }
});

router.delete('/suffixes/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.carSuffix.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Suffix not found' });
  }
});

// ── CarColour ────────────────────────────────────────────────────────────────

const ColourSchema = z.object({
  colourCode: z.string().min(1),
  colourName: z.string().min(1),
});

router.post('/:modelId/colours', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = ColourSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  try {
    const colour = await prisma.carColour.create({
      data: { ...parsed.data, carModelId: req.params.modelId },
    });
    res.status(201).json(colour);
  } catch {
    res.status(409).json({ error: 'Colour code already exists for this model' });
  }
});

router.delete('/colours/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.carColour.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Colour not found' });
  }
});

// ── Bulk Upload ───────────────────────────────────────────────────────────────
// Expected columns: modelCode, modelName, description (opt), suffix, suffixDescription (opt), colourCode, colourName
// Multiple rows can share the same model — they will be upserted and deduplicated

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const BulkRowSchema = z.object({
  modelCode: z.string().min(1),
  modelName: z.string().min(1),
  description: z.string().optional(),
  suffix: z.string().optional(),
  suffixDescription: z.string().optional(),
  colourCode: z.string().optional(),
  colourName: z.string().optional(),
});

router.post('/bulk-upload', requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  let success = 0;
  const rejected: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    // Normalise header keys
    const normalised: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = k.trim().replace(/\s+/g, '').replace(/^(.)/, (c) => c.toLowerCase());
      normalised[key] = typeof v === 'string' ? v.trim() : v;
    }

    const parsed = BulkRowSchema.safeParse(normalised);
    if (!parsed.success) {
      rejected.push({ row: i + 2, reason: JSON.stringify(parsed.error.flatten().fieldErrors) });
      continue;
    }

    try {
      // Upsert the car model
      const model = await prisma.carModel.upsert({
        where: { modelCode: parsed.data.modelCode },
        update: { modelName: parsed.data.modelName, description: parsed.data.description },
        create: { modelCode: parsed.data.modelCode, modelName: parsed.data.modelName, description: parsed.data.description },
      });

      // Upsert suffix if provided
      if (parsed.data.suffix) {
        await prisma.carSuffix.upsert({
          where: { carModelId_suffix: { carModelId: model.id, suffix: parsed.data.suffix } },
          update: { description: parsed.data.suffixDescription },
          create: { carModelId: model.id, suffix: parsed.data.suffix, description: parsed.data.suffixDescription },
        });
      }

      // Upsert colour if provided
      if (parsed.data.colourCode && parsed.data.colourName) {
        await prisma.carColour.upsert({
          where: { carModelId_colourCode: { carModelId: model.id, colourCode: parsed.data.colourCode } },
          update: { colourName: parsed.data.colourName },
          create: { carModelId: model.id, colourCode: parsed.data.colourCode, colourName: parsed.data.colourName },
        });
      }

      success++;
    } catch (e) {
      rejected.push({ row: i + 2, reason: String(e) });
    }
  }

  res.json({ total: rows.length, success, rejected });
});

export default router;
