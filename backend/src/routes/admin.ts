import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

const MODELS = ['INN', 'IMV', 'IMN', 'FRN'];

// POST /admin/mddp-swap
// Protected by CRON_SECRET header — called by the scheduled cloud agent every 3 hours
router.post('/mddp-swap', async (req: Request, res: Response) => {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // Fetch all active MDDP FP blockings for target models
    const mddpFP = await prisma.blockingRequest.findMany({
      where: {
        status: 'ACTIVE',
        paymentStatus: 'Full Payment Received',
        vehicle: { model: { in: MODELS }, stockStatus: 'MDDP' },
      },
      select: {
        id: true,
        fullPaymentAt: true,
        vehicleId: true,
        vehicle: { select: { id: true, chassisNumber: true, model: true, suffix: true, colour: true } },
        branch: { select: { branchCode: true } },
      },
    });

    // Fetch all active CTDMS non-FP blockings for target models
    const ctdmsNoFP = await prisma.blockingRequest.findMany({
      where: {
        status: 'ACTIVE',
        vehicle: { model: { in: MODELS }, stockStatus: 'CTDMS' },
        OR: [{ paymentStatus: null }, { paymentStatus: { not: 'Full Payment Received' } }],
      },
      select: {
        id: true,
        vehicleId: true,
        vehicle: { select: { id: true, chassisNumber: true, model: true, suffix: true, colour: true } },
        branch: { select: { branchCode: true } },
      },
    });

    // Build CTDMS map by model+suffix+colour — list of available donors per spec
    const ctdmsMap = new Map<string, typeof ctdmsNoFP>();
    for (const b of ctdmsNoFP) {
      const key = `${b.vehicle.model}|${b.vehicle.suffix}|${b.vehicle.colour}`;
      if (!ctdmsMap.has(key)) ctdmsMap.set(key, []);
      ctdmsMap.get(key)!.push(b);
    }

    // Group MDDP FP by spec, sort each group by fullPaymentAt ASC (earliest first)
    const mddpBySpec = new Map<string, typeof mddpFP>();
    for (const b of mddpFP) {
      const key = `${b.vehicle.model}|${b.vehicle.suffix}|${b.vehicle.colour}`;
      if (!mddpBySpec.has(key)) mddpBySpec.set(key, []);
      mddpBySpec.get(key)!.push(b);
    }
    for (const group of mddpBySpec.values()) {
      group.sort((a: (typeof mddpFP)[number], b: (typeof mddpFP)[number]) => {
        const ta = a.fullPaymentAt?.getTime() ?? 0;
        const tb = b.fullPaymentAt?.getTime() ?? 0;
        return ta - tb;
      });
    }

    const swapped: { mddp: string; ctdms: string; spec: string }[] = [];
    const skipped: { mddp: string; reason: string }[] = [];

    for (const [spec, mddpGroup] of mddpBySpec.entries()) {
      const donors = ctdmsMap.get(spec) ?? [];
      for (let i = 0; i < mddpGroup.length; i++) {
        const mddpBlocking = mddpGroup[i];
        const ctdmsBlocking = donors[i];
        if (!ctdmsBlocking) {
          skipped.push({ mddp: mddpBlocking.vehicle.chassisNumber, reason: 'No CTDMS donor available' });
          continue;
        }

        await prisma.$transaction([
          prisma.blockingRequest.update({
            where: { id: mddpBlocking.id },
            data: {
              vehicleId: ctdmsBlocking.vehicle.id,
              adminNotes: `Swapped to CTDMS vehicle ${ctdmsBlocking.vehicle.chassisNumber} — MDDP FP case`,
            },
          }),
          prisma.blockingRequest.update({
            where: { id: ctdmsBlocking.id },
            data: {
              vehicleId: mddpBlocking.vehicle.id,
              adminNotes: `Donor vehicle — MDDP VIN assigned from FP swap`,
            },
          }),
        ]);

        swapped.push({ spec, mddp: mddpBlocking.vehicle.chassisNumber, ctdms: ctdmsBlocking.vehicle.chassisNumber });
      }
    }

    console.log(`[mddp-swap] swapped=${swapped.length} skipped=${skipped.length}`);
    res.json({ ok: true, swapped, skipped });
  } catch (err) {
    console.error('[mddp-swap]', err);
    res.status(500).json({ error: 'Swap failed', detail: String(err) });
  }
});

export default router;
