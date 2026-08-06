import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { getBlockingDays } from '../services/modelDuration';
import { logAudit } from '../services/audit';
import { emitHeatmapUpdate, emitBlockingUpdate } from '../services/events';

const router = Router();
router.use(authenticate);

const MASKED_MODELS = ['INN', 'FRN', 'IMV'];

// Masked → actual chassis number map (revealed on Full Payment)
const CHASSIS_MAP: Record<string, string> = {
  'MBJAAXXXXXXXXX50': 'MBJAABAA701435976~0726',
  'MBJAAXXXXXXXXX51': 'MBJAABAA201435867~0726',
  'MBJAAXXXXXXXXX52': 'MBJABBAA301575987~0726',
  'MBJAAXXXXXXXXX53': 'MBJABBAA601575949~0726',
  'MBJAAXXXXXXXXX54': 'MBJAABAA101435858~0726',
  'MBJAAXXXXXXXXX55': 'MBJABBAA101575938~0726',
  'MBJAAXXXXXXXXX56': 'MBJABBAA501576056~0726',
  'MBJAAXXXXXXXXX57': 'MBJAABAA501435748~0726',
  'MBJAAXXXXXXXXX58': 'MBJAABAA101435746~0726',
  'MBJAAXXXXXXXXX59': 'MBJABBAA601575126~0726',
  'MBJAAXXXXXXXXX60': 'MBJABBAA001576451~0726',
  'MBJAAXXXXXXXXX61': 'MBJABBAA301575536~0726',
  'MBJAAXXXXXXXXX62': 'MBJABBAA001576305~0726',
  'MBJAAXXXXXXXXX63': 'MBJABBAA001575932~0726',
  'MBJAAXXXXXXXXX64': 'MBJABBAA701575894~0726',
  'MBJAAXXXXXXXXX65': 'MBJABBAA701575961~0726',
  'MBJAAXXXXXXXXX66': 'MBJABBAA701574437~0726',
  'MBJAAXXXXXXXXX67': 'MBJJB8EM101713274~0726',
  'MBJAAXXXXXXXXX68': 'MBJAABAA801435615~0726',
  'MBJAAXXXXXXXXX69': 'MBJABBAA201576418~0726',
  'MBJAAXXXXXXXXX70': 'MBJAABAA301435649~0726',
  'MBJAAXXXXXXXXX71': 'MBJABBAAX01576439~0726',
  'MBJAAXXXXXXXXX72': 'MBJAA3GS400667706~0726',
  'MBJAAXXXXXXXXX73': 'MBJABBAA001576434~0726',
  'MBJAAXXXXXXXXX74': 'MBJAB3EM504586160~0726',
  'MBJAAXXXXXXXXX75': 'MBJABBAA901575878~0726',
  'MBJAAXXXXXXXXX76': 'MBJABBAA501571522~0626',
  'MBJAAXXXXXXXXX77': 'MBJJB8EM301711073~0526',
  'MBJAAXXXXXXXXX78': 'MBJJB8EM601696231~0825',
  'MBJAAXXXXXXXXX79': 'MBJAA3GS700670146~0726',
  'MBJAAXXXXXXXXX80': 'MBJABBAA901577114~0726',
  'MBJAAXXXXXXXXX81': 'MBJABBAA901577064~0726',
  'MBJAAXXXXXXXXX82': 'MBJABBAA501577112~0726',
  'MBJAAXXXXXXXXX83': 'MBJAABAA801436215~0726',
  'MBJAAXXXXXXXXX84': 'MBJAABAA701436173~0726',
  'MBJAAXXXXXXXXX85': 'MBJAABAA901436126~0726',
  'MBJAAXXXXXXXXX86': 'MBJAABAA901436188~0726',
  'MBJAAXXXXXXXXX87': 'MBJAABAA601436133~0726',
  'MBJAAXXXXXXXXX88': 'MBJAABAA901436269~0726',
  'MBJAAXXXXXXXXX89': 'MBJAABAA901436272~0726',
  'MBJAAXXXXXXXXX90': 'MBJAABAA601436116~0726',
  'MBJAAXXXXXXXXX91': 'MBJAABAA201436145~0726',
  'MBJAAXXXXXXXXX92': 'MBJAABAA901436109~0726',
  'MBJAAXXXXXXXXX93': 'MBJAABAA801436246~0726',
  'MBJAAXXXXXXXXX94': 'MBJAABAA401436244~0726',
  'MBJAAXXXXXXXXX95': 'MBJAABAA201436288~0726',
  'MBJAAXXXXXXXXX96': 'MBJAABAA201436193~0726',
  'MBJAAXXXXXXXXX97': 'MBJAABAA501436186~0726',
  'MBJAAXXXXXXXXX98': 'MBJABBAA101577060~0726',
  'MBJAAXXXXXXXXX99': 'MBJABBAA001576689~0726',
  'MBJAAXXXXXXXXX100': 'MBJAABAA001436256~0726',
  'MBJAAXXXXXXXXX101': 'MBJAABAA301436204~0726',
  'MBJAAXXXXXXXXX102': 'MBJAA3GS200670099~0726',
  'MBJAAXXXXXXXXX103': 'MBJAABAA001436273~0726',
  'MBJAAXXXXXXXXX104': 'MBJAABAA601436147~0726',
  'MBJAAXXXXXXXXX105': 'MBJAABAA501436169~0726',
  'MBJAAXXXXXXXXX106': 'MBJAABAA101436251~0726',
  'MBJAAXXXXXXXXX107': 'MBJABBAAX01576988~0726',
  'MBJAAXXXXXXXXX108': 'MBJABBAA401576971~0726',
  'MBJAAXXXXXXXXX109': 'MBJAABAA201436100~0726',
  'MBJAAXXXXXXXXX110': 'MBJABBAA301576914~0726',
  'MBJAAXXXXXXXXX111': 'MBJABBAA801576908~0726',
  'MBJAAXXXXXXXXX112': 'MBJABBAA401576405~0726',
  'MBJAAXXXXXXXXX113': 'MBJAABAA901436112~0726',
  'MBJAAXXXXXXXXX114': 'MBJAABAA801435971~0726',
  'MBJAAXXXXXXXXX115': 'MBJAABAA201436128~0726',
  'MBJAAXXXXXXXXX116': 'MBJAABAA201435903~0726',
  'MBJAAXXXXXXXXX117': 'MBJABBAA301576007~0726',
  'MBJAAXXXXXXXXX118': 'MBJBE3FS601486837~0726',
  'MBJAAXXXXXXXXX119': 'MBJABBAA001576921~0726',
  'MBJAAXXXXXXXXX120': 'MBJAABAA501435944~0726',
  'MBJAAXXXXXXXXX121': 'MBJAABAA301436137~0726',
  'MBJAAXXXXXXXXX122': 'MBJABBAA301576928~0726',
  'MBJAAXXXXXXXXX123': 'MBJAABAA801436019~0726',
  'MBJAAXXXXXXXXX124': 'MBJAABAA101436072~0726',
  'MBJAAXXXXXXXXX125': 'MBJABBAA701576897~0726',
  'MBJAAXXXXXXXXX126': 'MBJAA3GS500669481~0726',
  'MBJAAXXXXXXXXX127': 'MBJAABAA201436162~0726',
  'MBJAAXXXXXXXXX128': 'MBJAABAA001436080~0726',
  'MBJAAXXXXXXXXX129': 'MBJAABAA401435739~0726',
  'MBJAAXXXXXXXXX130': 'MBJAABAA701436108~0726',
  'MBJAAXXXXXXXXX131': 'MBJAABAA501434695~0626',
  'MBJAAXXXXXXXXX132': 'MBJAABAA701435900~0726',
  'MBJAAXXXXXXXXX133': 'MBJAABAA401435823~0726',
  'MBJAAXXXXXXXXX134': 'MBJAABAA101435844~0726',
  'MBJAAXXXXXXXXX135': 'MBJAABAA701435685~0726',
  'MBJAAXXXXXXXXX136': 'MBJAABAA601435824~0726',
  'MBJAAXXXXXXXXX137': 'MBJAABAA001435298~0726',
  'MBJAAXXXXXXXXX138': 'MBJAABAA501435880~0726',
  'MBJAAXXXXXXXXX139': 'MBJAABAA001435396~0726',
  'MBJAAXXXXXXXXX140': 'MBJAABAA001435575~0726',
  'MBJAAXXXXXXXXX141': 'MBJAABAA201434959~0726',
  'MBJAAXXXXXXXXX142': 'MBJAA3GS500669593~0726',
  'MBJAAXXXXXXXXX143': 'MBJAABAAX01435731~0726',
  'MBJAAXXXXXXXXX144': 'MBJAABAA501435541~0726',
  'MBJAAXXXXXXXXX145': 'MBJAABAA101435665~0726',
  'MBJAAXXXXXXXXX146': 'MBJABBAA101575907~0726',
  'MBJAAXXXXXXXXX147': 'MBJABBAA901576500~0726',
  'MBJAAXXXXXXXXX148': 'MBJABBAA001575350~0726',
  'MBJAAXXXXXXXXX149': 'MBJABBAA801576519~0726',
  'MBJAAXXXXXXXXX150': 'MBJABBAA401575867~0726',
  'MBJAAXXXXXXXXX151': 'MBJABBAA901576108~0726',
  'MBJAAXXXXXXXXX152': 'MBJAABAA701435783~0726',
  'MBJAAXXXXXXXXX153': 'MBJABBAA001576448~0726',
  'MBJAAXXXXXXXXX154': 'MBJABBAA901576092~0726',
  'MBJAAXXXXXXXXX155': 'MBJAA3GS300669544~0726',
  'MBJAAXXXXXXXXX156': 'MBJAABAA501435376~0726',
  'MBJAAXXXXXXXXX157': 'MBJABBAA001575896~0726',
  'MBJAAXXXXXXXXX158': 'MBJAABAA301435473~0726',
  'MBJAAXXXXXXXXX159': 'MBJABBAA501575005~0726',
  'MBJAAXXXXXXXXX160': 'MBJABBAA901574200~0726',
  'MBJAAXXXXXXXXX161': 'MBJABBAAX01575341~0726',
  'MBJAAXXXXXXXXX162': 'MBJABBAA101575826~0726',
  'MBJAAXXXXXXXXX163': 'MBJAABAA101435729~0726',
  'MBJAAXXXXXXXXX164': 'MBJAABAA701435654~0726',
  'MBJAAXXXXXXXXX165': 'MBJAA3GS300667826~0726',
  'MBJAAXXXXXXXXX166': 'MBJAABAA601435533~0726',
  'MBJAAXXXXXXXXX167': 'MBJABBAA901576514~0726',
  'MBJAAXXXXXXXXX168': 'MBJABBAA801575077~0726',
  'MBJAAXXXXXXXXX169': 'MBJABBAA601575014~0726',
  'MBJAAXXXXXXXXX170': 'MBJABBAA801575502~0726',
  'MBJAAXXXXXXXXX171': 'MBJAABAA501435622~0726',
  'MBJAAXXXXXXXXX172': 'MBJABBAA301541483~1225',
  'MBJAAXXXXXXXXX173': 'MBJJB8EM001714870~0726',
  'MBJAAXXXXXXXXX174': 'MBJAABAA401434753~0626',
  'MBJAAXXXXXXXXX175': 'MBJAABAA601434852~0726',
  'MBJAAXXXXXXXXX176': 'MBJAA3GS000667251~0626',
  'MBJAAXXXXXXXXX177': 'MBJABBAA401546949~0126',
  'MBJAAXXXXXXXXX178': 'MBJBE3FS401486240~0626',
  'MBJAAXXXXXXXXX179': 'MBJABBAA001575719~0726',
  'MBJAAXXXXXXXXX180': 'MBJJB8EMX01712673~0626',
  'MBJAAXXXXXXXXX181': 'MBJABBAA101571887~0626',
  'MBJAAXXXXXXXXX182': 'MBJAB3EM904583696~0526',
  'MBJAAXXXXXXXXX183': 'MBJABBAAX01570883~0626',
  'MBJAAXXXXXXXXX184': 'MBJAB3EM204583622~0526',
  'MBJAAXXXXXXXXX185': 'MBJJB8EM601704876~0226',
  'MBJAAXXXXXXXXX186': 'MBJABBAA301539622~1225',
  'MBJAAXXXXXXXXX187': 'MBJABBAA201537716~1125',
};

// Reveal actual chassis number if vehicle has a masked chassis
async function revealChassis(vehicleId: string): Promise<void> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { chassisNumber: true } });
  if (!vehicle) return;
  const actual = CHASSIS_MAP[vehicle.chassisNumber];
  if (!actual) return;
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { chassisNumber: actual } });
  console.log(`[reveal] ${vehicle.chassisNumber} → ${actual}`);
}

// On Full Payment for an MDDP INN/FRN/IMV blocking:
//   swap the blocking to a matching CTDMS/BND vehicle and reveal its actual chassis.
// On Full Payment for a CTDMS INN/FRN/IMV blocking:
//   just reveal the actual chassis.
async function swapAndReveal(blockingId: string, vehicleId: string): Promise<void> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, model: true, suffix: true, colour: true, stockStatus: true },
  });
  if (!vehicle || !MASKED_MODELS.includes(vehicle.model)) return;

  if (vehicle.stockStatus === 'MDDP') {
    const replacement = await prisma.vehicle.findFirst({
      where: {
        model: vehicle.model,
        suffix: vehicle.suffix,
        colour: vehicle.colour,
        stockStatus: { in: ['CTDMS', 'BND'] },
        status: { not: 'DELIVERED' },
        id: { not: vehicleId },
      },
      orderBy: { assignmentDate: 'asc' },
    });
    if (!replacement) { console.log(`[swap] no CTDMS/BND for ${vehicle.model}/${vehicle.suffix}/${vehicle.colour}`); return; }

    await prisma.blockingRequest.updateMany({ where: { vehicleId: replacement.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
    await prisma.blockingRequest.update({ where: { id: blockingId }, data: { vehicleId: replacement.id } });
    await Promise.all([
      prisma.vehicle.update({ where: { id: replacement.id }, data: { status: 'HARD_BLOCKED' } }),
      prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'OPEN' } }),
    ]);
    console.log(`[swap] ${vehicle.model}/${vehicle.suffix}/${vehicle.colour} MDDP→CTDMS ${replacement.id}`);
    await revealChassis(replacement.id);
  } else if (vehicle.stockStatus === 'CTDMS' || vehicle.stockStatus === 'BND') {
    await revealChassis(vehicleId);
  }
}

// Canonical payment status values — enforced at every write point
const PAYMENT_STATUSES = [
  'Down Payment Received',
  'Only Booking Received',
  'Part Payment Received',
  'Full Payment Received',
  'Ready for Disbursement',
] as const;
const paymentStatusEnum = z.enum(PAYMENT_STATUSES);

// Expiry = 11:00 PM IST on the Nth day from today (IST date)
function hardBlockExpiry(days: number): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  // Midnight IST on (today + days) expressed as a UTC timestamp
  const expiryMidnightIst = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate() + days,
  );
  // 23:00 IST = midnight IST + 23 h, then subtract IST offset to get UTC
  return new Date(expiryMidnightIst - IST_OFFSET_MS + 23 * 60 * 60 * 1000);
}

// When paymentStatus changes to/from 'Full Payment Received', update expiryAt + fullPaymentAt
function fullPaymentFields(newStatus: string, existingStatus?: string | null): Record<string, unknown> {
  if (newStatus === 'Full Payment Received') {
    return { expiryAt: null, fullPaymentAt: new Date() };
  }
  if (existingStatus === 'Full Payment Received') {
    // Moving away from Full Payment Received — clear the timestamp (expiry restored by admin if needed)
    return { fullPaymentAt: null };
  }
  return {};
}

// POST /blocking/soft — atomic soft block
router.post('/soft', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({
    model: z.string().min(1),
    suffix: z.string().min(1),
    colour: z.string().min(1),
    chassisYear: z.number().int().optional(),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  // Trim to guard against trailing spaces from Excel-imported data
  const model = parsed.data.model.trim();
  const suffix = parsed.data.suffix.trim();
  const colour = parsed.data.colour.trim();
  const { chassisYear } = parsed.data;
  const userId = req.user!.userId;
  const branchId = req.user!.branchId;

  if (!branchId) { res.status(403).json({ error: 'No branch assigned to your account — contact admin' }); return; }

  // Atomic: find an OPEN vehicle and soft-block it in a single transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Fetch all OPEN candidates for this year (if specified) and filter with trim
      // so that trailing spaces in Excel-imported data never block a booking
      const candidates = await tx.vehicle.findMany({
        where: {
          status: 'OPEN',
          hiddenFromHeatmap: false,
          ...(chassisYear ? { chassisYear } : {}),
        },
        select: { id: true, model: true, suffix: true, colour: true, stockStatus: true, chassisYear: true, assignmentDate: true, chassisNumber: true },
      });

      // Strip ALL unicode whitespace (including non-breaking spaces  , zero-width, etc.)
      const clean = (s: string) => s.replace(/[ ​﻿\s]+/g, ' ').trim();

      const matching = candidates.filter(
        (v) => clean(v.model) === clean(model) && clean(v.suffix) === clean(suffix) && clean(v.colour) === clean(colour),
      );


      // Sort: earliest assignmentDate first (chassisYear is fixed by the request filter or irrelevant)
      matching.sort((a, b) => {
        const aDate = a.assignmentDate ? new Date(a.assignmentDate).getTime() : 0;
        const bDate = b.assignmentDate ? new Date(b.assignmentDate).getTime() : 0;
        return aDate - bDate;
      });

      // Priority: BND → CTDMS → MDDP → any (within each tier, sort order above applies)
      const PRIORITY = ['BND', 'CTDMS', 'MDDP'] as const;
      let vehicle: { id: string; chassisNumber: string; model: string; suffix: string; colour: string; stockStatus: string | null; chassisYear: number; assignmentDate: Date | null } | null = null;
      for (const ss of PRIORITY) {
        vehicle = matching.find((v) => v.stockStatus === ss) ?? null;
        if (vehicle) break;
      }
      if (!vehicle) vehicle = matching[0] ?? null;

      console.log(`[soft-block] query="${model}/${suffix}/${colour}" candidates=${candidates.length} matching=${matching.length} picked=${vehicle?.id ?? 'NONE'}`);

      if (!vehicle) throw new Error(chassisYear ? `NO_VEHICLE_YEAR_${chassisYear}` : 'NO_VEHICLE');

      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { status: 'SOFT_BLOCKED' },
      });

      const blocking = await tx.blockingRequest.create({
        data: {
          vehicleId: vehicle.id,
          userId,
          branchId,
          blockType: 'SOFT',
          softBlockAt: new Date(),
          expiryAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      return { ...blocking, chassisNumber: vehicle.chassisNumber, model: vehicle.model };
    });

    emitHeatmapUpdate();
    res.status(201).json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'NO_VEHICLE') {
      res.status(409).json({ error: 'No open vehicle found for this combination — please select again' });
    } else if (msg.startsWith('NO_VEHICLE_YEAR_')) {
      const yr = msg.split('_').pop();
      res.status(409).json({ error: `No open ${yr} unit available for this variant. Try clearing the YOM filter to see all years.` });
    } else {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// GET /blocking/offer-vehicles — OPEN vehicles for offers page (frontend does incentive lookup)
router.get('/offer-vehicles', async (_req: AuthRequest, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'OPEN', hiddenFromHeatmap: false },
    select: { model: true, suffix: true, colour: true, chassisNumber: true, assignmentDate: true, stockStatus: true, chassisYear: true },
    orderBy: { assignmentDate: 'asc' },
  });
  res.json(vehicles);
});

// POST /blocking/offer-soft — soft block by model+suffix (earliest assignmentDate, BND→CTDMS priority)
router.post('/offer-soft', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ model: z.string().min(1), suffix: z.string().min(1) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const model = parsed.data.model.trim();
  const suffix = parsed.data.suffix.trim();
  const userId = req.user!.userId;
  const branchId = req.user!.branchId;
  if (!branchId) { res.status(403).json({ error: 'No branch assigned' }); return; }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const candidates = await tx.vehicle.findMany({
        where: { status: 'OPEN', hiddenFromHeatmap: false },
        select: { id: true, model: true, suffix: true, chassisNumber: true, assignmentDate: true, stockStatus: true },
        orderBy: { assignmentDate: 'asc' },
      });

      const clean = (s: string) => s.replace(/[\s ​﻿]+/g, ' ').trim();
      const matching = candidates.filter(
        (v) => clean(v.model) === clean(model) && clean(v.suffix) === clean(suffix),
      );

      const PRIORITY = ['BND', 'CTDMS', 'MDDP'] as const;
      let vehicle: { id: string; chassisNumber: string; model: string } | null = null;
      for (const ss of PRIORITY) {
        vehicle = matching.find((v) => v.stockStatus === ss) ?? null;
        if (vehicle) break;
      }
      if (!vehicle) vehicle = matching[0] ?? null;
      if (!vehicle) throw new Error('NO_VEHICLE');

      await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: 'SOFT_BLOCKED' } });
      const blocking = await tx.blockingRequest.create({
        data: {
          vehicleId: vehicle.id,
          userId,
          branchId,
          blockType: 'SOFT',
          softBlockAt: new Date(),
          expiryAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      return { ...blocking, chassisNumber: vehicle.chassisNumber };
    });

    emitHeatmapUpdate();
    res.status(201).json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'NO_VEHICLE') {
      res.status(409).json({ error: 'No open vehicle found for this combination' });
    } else {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// POST /blocking/hard — convert soft to hard block
router.post('/hard', async (req: AuthRequest, res: Response) => {
  const isTeamLeader = req.user!.role === 'TEAM_LEADER';

  // Team Leaders only submit customer credentials — no financial payload
  const TLSchema = z.object({
    blockingId: z.string().uuid(),
    chassisYear: z.number().int(),
    orderId: z.string().min(1),
    customerName: z.string().min(1),
    consultantName: z.string().min(1),
    teamLeaderName: z.string().optional(),
  });

  const SMSchema = z.object({
    blockingId: z.string().uuid(),
    chassisYear: z.number().int(),
    orderId: z.string().min(1),
    customerName: z.string().min(1),
    consultantName: z.string().min(1),
    teamLeaderName: z.string().optional(),
    paymentMode: z.enum(['CASH', 'FINANCE']),
    amountReceived: z.number().optional(),
    financierBank: z.string().optional(),
    paymentStatus: paymentStatusEnum,
    expectedBillingDate: z.string().datetime().optional(),
  });

  const parsed = isTeamLeader ? TLSchema.safeParse(req.body) : SMSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { blockingId, chassisYear, ...formData } = parsed.data;
  const userId = req.user!.userId;

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: blockingId },
    include: { vehicle: true },
  });

  if (!existing || existing.userId !== userId || existing.blockType !== 'SOFT' || existing.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Soft block not found or already expired' });
    return;
  }

  // Check soft block still valid (5 min)
  if (existing.expiryAt && existing.expiryAt < new Date()) {
    res.status(409).json({ error: 'Soft block has expired — please start again' });
    return;
  }

  const days = await getBlockingDays(existing.vehicle.model, existing.vehicle.stockStatus);
  const defaultExpiry = hardBlockExpiry(days);

  // Team Leaders have no paymentStatus, so no full-payment logic
  const paymentStatus = (formData as { paymentStatus?: string }).paymentStatus;
  const fpFields = paymentStatus ? fullPaymentFields(paymentStatus) : {};
  const expiryAt = (fpFields as { expiryAt?: Date | null }).expiryAt !== undefined
    ? ((fpFields as { expiryAt: Date | null }).expiryAt)
    : defaultExpiry;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: existing.vehicleId },
        data: { chassisYear, status: 'HARD_BLOCKED' },
      });

      const { expectedBillingDate, ...restFormData } = formData as typeof formData & { expectedBillingDate?: string };
      return tx.blockingRequest.update({
        where: { id: blockingId },
        data: {
          blockType: 'HARD',
          hardBlockAt: new Date(),
          expiryAt,
          ...fpFields,
          ...restFormData,
          ...(expectedBillingDate ? { expectedBillingDate: new Date(expectedBillingDate) } : {}),
        },
        include: { vehicle: true, branch: true },
      });
    });

    await logAudit({
      entityType: 'BLOCKING',
      entityId: blockingId,
      action: 'HARD_BLOCKED',
      performedById: userId,
      newValue: { status: 'HARD_BLOCKED', expiryAt },
    });

    emitHeatmapUpdate();
    emitBlockingUpdate(blockingId);
    res.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: 'Failed to confirm block', detail: msg });
  }
});

// POST /blocking/admin-block — admin creates a hard block directly on behalf of a sales manager
router.post('/admin-block', requireAdmin, async (req: AuthRequest, res: Response) => {
  const Schema = z.object({
    vehicleId: z.string().min(1),
    onBehalfOfUserId: z.string().min(1),
    orderId: z.string().regex(/^\d{7}$/, 'Order ID must be exactly 7 digits'),
    customerName: z.string().min(1),
    consultantName: z.string().min(1),
    teamLeaderName: z.string().optional(),
    paymentMode: z.enum(['CASH', 'FINANCE']),
    amountReceived: z.number().optional(),
    financierBank: z.string().optional(),
    paymentStatus: paymentStatusEnum,
    expectedBillingDate: z.string().datetime().optional(),
  });

  console.log('[admin-block] body:', JSON.stringify(req.body));
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    const message = Object.entries(fields).map(([k, v]) => `${k}: ${v?.join(', ')}`).join(' | ') || 'Invalid request';
    console.log('[admin-block] validation failed:', message);
    res.status(400).json({ error: message });
    return;
  }

  const { vehicleId, onBehalfOfUserId, ...formData } = parsed.data;

  // Get the user and their branch (before transaction — read-only, safe)
  const onBehalfUser = await prisma.user.findUnique({ where: { id: onBehalfOfUserId }, select: { id: true, branchId: true, fullName: true } });
  if (!onBehalfUser) { res.status(404).json({ error: 'User not found' }); return; }
  if (!onBehalfUser.branchId) { res.status(400).json({ error: 'Selected user has no branch assigned' }); return; }

  // Pre-fetch vehicle for getBlockingDays (model/stockStatus needed before tx)
  const vehicleCheck = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicleCheck) { res.status(404).json({ error: 'Vehicle not found' }); return; }

  const days = await getBlockingDays(vehicleCheck.model, vehicleCheck.stockStatus);
  const now = new Date();
  const defaultExpiry = hardBlockExpiry(days);
  const fpFields = fullPaymentFields(formData.paymentStatus);
  const expiryAt = fpFields.expiryAt !== undefined ? (fpFields.expiryAt as Date | null) : defaultExpiry;

  try {
    const blocking = await prisma.$transaction(async (tx) => {
      // ── Atomic OPEN check + status flip ──────────────────────────────────────
      // updateMany returns count=0 if vehicle is not OPEN, preventing race conditions
      // where two admins block the same vehicle simultaneously.
      const claimed = await tx.vehicle.updateMany({
        where: { id: vehicleId, status: 'OPEN' },
        data: { status: 'HARD_BLOCKED' },
      });
      if (claimed.count === 0) throw new Error('VEHICLE_NOT_OPEN');
      return tx.blockingRequest.create({
        data: {
          vehicleId,
          userId: onBehalfUser.id,
          branchId: onBehalfUser.branchId!,
          blockType: 'HARD',
          softBlockAt: now,
          hardBlockAt: now,
          expiryAt,
          ...(fpFields.fullPaymentAt ? { fullPaymentAt: fpFields.fullPaymentAt as Date } : {}),
          orderId: formData.orderId,
          customerName: formData.customerName,
          consultantName: formData.consultantName,
          teamLeaderName: formData.teamLeaderName,
          paymentMode: formData.paymentMode,
          amountReceived: formData.amountReceived,
          financierBank: formData.financierBank,
          paymentStatus: formData.paymentStatus,
          expectedBillingDate: formData.expectedBillingDate ? new Date(formData.expectedBillingDate) : undefined,
        },
        include: { vehicle: true, branch: true },
      });
    });

    await logAudit({
      entityType: 'BLOCKING',
      entityId: blocking.id,
      action: 'ADMIN_HARD_BLOCKED',
      performedById: req.user!.userId,
      newValue: { onBehalfOf: onBehalfUser.fullName, vehicleId, expiryAt },
    });

    emitHeatmapUpdate();
    emitBlockingUpdate(blocking.id);
    res.status(201).json(blocking);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'VEHICLE_NOT_OPEN') {
      res.status(409).json({ error: 'Vehicle is not open — it may have just been taken by another user' });
    } else {
      res.status(500).json({ error: 'Failed to create block', detail: msg });
    }
  }
});

// PATCH /blocking/:id/details — owner updates customer name, order ID, expected billing date, consultant, team leader
router.patch('/:id/details', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({
    customerName: z.string().optional(),
    orderId: z.string().optional(),
    expectedBillingDate: z.string().datetime().nullable().optional(),
    consultantName: z.string().optional(),
    teamLeaderName: z.string().optional(),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { role: true, branchId: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  // Sales Manager can edit Team Leader blockings from their own branch
  const isSmEditingTl = req.user!.role === 'SALES_MANAGER'
    && (existing.user.role as string) === 'TEAM_LEADER'
    && existing.user.branchId === req.user!.branchId;
  if (!isOwner && !isAdmin && !isSmEditingTl) { res.status(403).json({ error: 'Forbidden' }); return; }

  if (existing.status !== 'ACTIVE') { res.status(409).json({ error: 'Booking is not active' }); return; }

  const data: Record<string, unknown> = {};
  if (parsed.data.customerName !== undefined) data.customerName = parsed.data.customerName;
  if (parsed.data.orderId !== undefined) data.orderId = parsed.data.orderId;
  if (parsed.data.expectedBillingDate !== undefined) {
    data.expectedBillingDate = parsed.data.expectedBillingDate ? new Date(parsed.data.expectedBillingDate) : null;
  }
  if (parsed.data.consultantName !== undefined) data.consultantName = parsed.data.consultantName;
  if (parsed.data.teamLeaderName !== undefined) data.teamLeaderName = parsed.data.teamLeaderName;

  const updated = await prisma.blockingRequest.update({ where: { id: req.params.id }, data });

  await logAudit({
    entityType: 'BLOCKING',
    entityId: req.params.id,
    action: 'DETAILS_UPDATED',
    performedById: req.user!.userId,
    previousValue: { customerName: existing.customerName, orderId: existing.orderId, expectedBillingDate: existing.expectedBillingDate },
    newValue: data,
  });

  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

// PATCH /blocking/:id/payment-status — owner or SM (for TL bookings in same branch) updates payment status
router.patch('/:id/payment-status', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ paymentStatus: z.string().min(1) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { role: true, branchId: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const isSmOverTl = req.user!.role === 'SALES_MANAGER'
    && (existing.user.role as string) === 'TEAM_LEADER'
    && existing.user.branchId === req.user!.branchId;
  if (!isOwner && !isAdmin && !isSmOverTl) { res.status(403).json({ error: 'Forbidden' }); return; }

  if (existing.status !== 'ACTIVE') { res.status(409).json({ error: 'Booking is not active' }); return; }

  const fpFields = fullPaymentFields(parsed.data.paymentStatus, existing.paymentStatus);
  const updated = await prisma.blockingRequest.update({
    where: { id: req.params.id },
    data: { paymentStatus: parsed.data.paymentStatus, ...fpFields },
    include: { vehicle: true },
  });

  if (parsed.data.paymentStatus === 'Full Payment Received') {
    await swapAndReveal(req.params.id, updated.vehicle.id);
    emitHeatmapUpdate();
  }

  await logAudit({
    entityType: 'BLOCKING',
    entityId: req.params.id,
    action: 'PAYMENT_STATUS_UPDATED',
    performedById: req.user!.userId,
    previousValue: { paymentStatus: existing.paymentStatus },
    newValue: { paymentStatus: parsed.data.paymentStatus },
  });

  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

// GET /blocking/my
router.get('/my', async (req: AuthRequest, res: Response) => {
  const { userId, role, branchId } = req.user!;

  // Sales Managers also see blockings made by Team Leaders in the same branch
  const where = role === 'SALES_MANAGER' && branchId
    ? { OR: [{ userId }, { user: { role: 'TEAM_LEADER' as const, branchId } }] }
    : { userId };

  const blockings = await prisma.blockingRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      vehicle: true,
      branch: { select: { name: true } },
      financeRecord: true,
      user: { select: { id: true, fullName: true, role: true } },
    },
  });

  res.json(blockings);
});

// GET /blocking/all — admin
router.get('/all', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { branchId, status, blockType, model, chassis, search, from, to, blockedFrom, blockedTo, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (blockType) where.blockType = blockType;

  // Vehicle filter — model and/or chassis
  const vehicleFilter: Record<string, unknown> = {};
  if (model) vehicleFilter.model = { contains: model, mode: 'insensitive' };
  if (chassis) vehicleFilter.chassisNumber = { contains: chassis, mode: 'insensitive' };
  if (Object.keys(vehicleFilter).length > 0) where.vehicle = vehicleFilter;

  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { orderId: { contains: search, mode: 'insensitive' } },
      { vehicle: { chassisNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (blockedFrom || blockedTo) {
    where.hardBlockAt = {
      ...(blockedFrom ? { gte: new Date(blockedFrom) } : {}),
      ...(blockedTo ? { lte: new Date(new Date(blockedTo).setHours(23, 59, 59, 999)) } : {}),
    };
  }

  const [blockings, total] = await Promise.all([
    prisma.blockingRequest.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: true,
        user: { select: { fullName: true, loginId: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.blockingRequest.count({ where }),
  ]);
  res.json({ blockings, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /blocking/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const blocking = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { vehicle: true, user: { select: { fullName: true, loginId: true } }, branch: true },
  });
  if (!blocking) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = blocking.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  if (!isOwner && !isAdmin) { res.status(403).json({ error: 'Forbidden' }); return; }

  res.json(blocking);
});

// PATCH /blocking/:id — admin edit
router.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.blockingRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const EditSchema = z.object({
    customerName: z.string().optional(),
    consultantName: z.string().optional(),
    paymentMode: z.enum(['CASH', 'FINANCE']).optional(),
    financierBank: z.string().optional(),
    paymentStatus: paymentStatusEnum.optional(),
    expectedBillingDate: z.string().datetime().optional(),
    adminNotes: z.string().optional(),
  });

  const parsed = EditSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.expectedBillingDate) data.expectedBillingDate = new Date(parsed.data.expectedBillingDate);
  if (parsed.data.paymentStatus) Object.assign(data, fullPaymentFields(parsed.data.paymentStatus, existing.paymentStatus));

  const updated = await prisma.blockingRequest.update({
    where: { id: req.params.id },
    data,
    include: { vehicle: true },
  });

  if (parsed.data.paymentStatus === 'Full Payment Received' && existing.paymentStatus !== 'Full Payment Received') {
    await swapAndReveal(req.params.id, updated.vehicle.id);
    emitHeatmapUpdate();
  }

  await logAudit({ entityType: 'BLOCKING', entityId: req.params.id, action: 'EDITED', performedById: req.user!.userId, previousValue: existing, newValue: updated });

  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

// PATCH /blocking/:id/extend
router.patch('/:id/extend', requireAdmin, async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ expiryAt: z.string().datetime() });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await prisma.blockingRequest.update({
    where: { id: req.params.id },
    data: { expiryAt: new Date(parsed.data.expiryAt), extendedByAdmin: true },
  });

  await logAudit({ entityType: 'BLOCKING', entityId: req.params.id, action: 'EXTENDED', performedById: req.user!.userId, previousValue: { expiryAt: existing.expiryAt }, newValue: { expiryAt: updated.expiryAt } });

  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

// PATCH /blocking/:id/release — admin manual release
router.patch('/:id/release', requireAdmin, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.blockingRequest.findUnique({ where: { id: req.params.id }, include: { vehicle: true } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  await prisma.$transaction([
    prisma.blockingRequest.update({ where: { id: req.params.id }, data: { status: 'EXPIRED', adminNotes: 'Manually released by admin' } }),
    prisma.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'OPEN' } }),
  ]);

  await logAudit({ entityType: 'BLOCKING', entityId: req.params.id, action: 'RELEASED', performedById: req.user!.userId, previousValue: { status: existing.status }, newValue: { status: 'EXPIRED' } });

  emitHeatmapUpdate();
  emitBlockingUpdate(req.params.id);
  res.json({ ok: true });
});

// PATCH /blocking/:id/self-release — owner releases their own booking back to open pool
router.patch('/:id/self-release', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({
    reason: z.string().min(1),
    salesId: z.string().min(1),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { vehicle: true, user: { select: { role: true, branchId: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const isSmOverTl = req.user!.role === 'SALES_MANAGER'
    && (existing.user.role as string) === 'TEAM_LEADER'
    && existing.user.branchId === req.user!.branchId;
  if (!isOwner && !isAdmin && !isSmOverTl) { res.status(403).json({ error: 'Forbidden' }); return; }

  if (existing.status !== 'ACTIVE') {
    res.status(409).json({ error: 'Booking is not active' });
    return;
  }

  await prisma.$transaction([
    prisma.blockingRequest.update({
      where: { id: req.params.id },
      data: { status: 'EXPIRED', adminNotes: `Released by sales. Reason: ${parsed.data.reason} | Sales ID: ${parsed.data.salesId}` },
    }),
    prisma.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'OPEN' } }),
  ]);

  await logAudit({
    entityType: 'BLOCKING',
    entityId: req.params.id,
    action: 'SELF_RELEASED',
    performedById: req.user!.userId,
    previousValue: { status: existing.status },
    newValue: { status: 'EXPIRED', reason: parsed.data.reason, salesId: parsed.data.salesId },
  });

  emitHeatmapUpdate();
  emitBlockingUpdate(req.params.id);
  res.json({ ok: true });
});

// PATCH /blocking/:id/deliver
router.patch('/:id/deliver', async (req: AuthRequest, res: Response) => {
  const Schema = z.object({ retailId: z.string().min(1) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.blockingRequest.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { role: true, branchId: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = existing.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const isSmOverTl = req.user!.role === 'SALES_MANAGER'
    && (existing.user.role as string) === 'TEAM_LEADER'
    && existing.user.branchId === req.user!.branchId;
  if (!isOwner && !isAdmin && !isSmOverTl) { res.status(403).json({ error: 'Forbidden' }); return; }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'DELIVERED' } });
    return tx.blockingRequest.update({
      where: { id: req.params.id },
      data: { status: 'DELIVERED', retailId: parsed.data.retailId, deliveredAt: new Date() },
    });
  });

  await logAudit({ entityType: 'BLOCKING', entityId: req.params.id, action: 'DELIVERED', performedById: req.user!.userId, newValue: { retailId: parsed.data.retailId } });

  emitHeatmapUpdate();
  emitBlockingUpdate(req.params.id);
  res.json(updated);
});

export default router;
