import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { BRANCH_GROUPS } from '../lib/branchGroups';

const router = Router();

// GET /admin/mtd-tally — list every branch group with its current target + MTD tally
router.get('/mtd-tally', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.branchMtdTally.findMany({
    where: { branchCode: { in: BRANCH_GROUPS.map((g) => g.branchCode) } },
  });
  const byCode = new Map(rows.map((r) => [r.branchCode, r]));

  const result = BRANCH_GROUPS.map((g) => ({
    display: g.display,
    branchCode: g.branchCode,
    target: byCode.get(g.branchCode)?.target ?? 0,
    mtdTally: byCode.get(g.branchCode)?.mtdTally ?? 0,
  }));
  res.json(result);
});

// PUT /admin/mtd-tally — bulk upsert target + MTD tally per branch group
const MtdTallySchema = z.object({
  rows: z.array(z.object({
    branchCode: z.string().min(1),
    target: z.coerce.number().int().min(0),
    mtdTally: z.coerce.number().int().min(0),
  })),
});

router.put('/mtd-tally', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = MtdTallySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const validCodes = new Set(BRANCH_GROUPS.map((g) => g.branchCode));
  const rows = parsed.data.rows.filter((r) => validCodes.has(r.branchCode));

  await prisma.$transaction(
    rows.map((r) =>
      prisma.branchMtdTally.upsert({
        where: { branchCode: r.branchCode },
        update: { target: r.target, mtdTally: r.mtdTally },
        create: { branchCode: r.branchCode, target: r.target, mtdTally: r.mtdTally },
      })
    )
  );

  res.json({ ok: true, updated: rows.length });
});

export default router;
