import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const ROWS = [
  [2026,'FRN','FRN1L','2PS','202605143671','2026-06-05','TI01A'],
  [2026,'FRN','FRN1L','2PS','202605143675','2026-06-17','MV01A'],
  [2026,'FRN','FRNB6','2UE','202605143686','2026-06-14','TI01A'],
  [2026,'FRN','FRNB6','2PS','ST5260616092','2026-06-16','MV01A'],
  [2026,'FRN','FRNBK','089','202605143691','2026-06-18','IR01A'],
  [2026,'IMV','IMVIQ','218','ST5260617024','2026-06-13','MV01A'],
  [2026,'IMV','IMVIS','089','ST5260616832','2026-06-04','IR01A'],
  [2026,'IMV','IMVIT','089','ST5260617535','2026-06-14','TI01A'],
  [2026,'IMV','IMVIT','089','ST5260617533','2026-06-21','IR01A'],
  [2026,'IMV','IMVIU','218','ST5260617225','2026-06-09','MV01A'],
  [2026,'IMV','IMVIU','089','ST5260617183','2026-06-11','MV01A'],
  [2026,'IMV','IMVIU','218','ST5260617227','2026-06-11','TI01A'],
  [2026,'IMV','IMVIU','1D6','ST5260617218','2026-06-19','TI01A'],
  [2026,'IMV','IMVIC','218','ST5260611778','2026-06-16','TI01A'],
  [2026,'INN','INNHZ','2PS','202605143707','2026-06-03','MV01A'],
  [2026,'INN','INNHZ','2PS','202605143708','2026-06-03','TI01A'],
  [2026,'INN','INNHZ','2UE','202605143722','2026-06-07','MV01A'],
  [2026,'INN','INNHZ','2PS','ST5260616146','2026-06-17','TI01A'],
  [2026,'INN','INNHZ','2PS','202605143720','2026-06-20','IR01A'],
  [2026,'INN','INNYA','040','202605143727','2026-06-07','TI01A'],
  [2026,'INN','INNYA','221','202605143775','2026-06-09','IR01A'],
  [2026,'INN','INNYA','218','202605143762','2026-06-12','MV01A'],
  [2026,'INN','INNYA','218','202605143763','2026-06-13','TI01A'],
  [2026,'INN','INNYA','040','202605143729','2026-06-14','MV01A'],
  [2026,'INN','INNYA','218','202605143765','2026-06-17','IR01A'],
  [2026,'INN','INNYA','221','202605143777','2026-06-17','TI01A'],
  [2026,'INN','INNYA','089','ST5260616169','2026-06-17','MV01A'],
  [2026,'INN','INNYA','089','202605143735','2026-06-19','IR01A'],
  [2026,'INN','INNYB','1D6','ST5260616183','2026-06-18','TI01A'],
  [2026,'INN','INNYD','1D6','202605143789','2026-06-20','IR01A'],
  [2026,'INN','INNYE','218','202605143799','2026-06-06','TI01A'],
  [2026,'INN','INNYE','089','202605143795','2026-06-18','MV01A'],
  [2026,'INN','INNYE','1D6','202605143797','2026-06-18','IR01A'],
  [2026,'INN','INNYF','040','202605143804','2026-06-16','TI01A'],
  [2026,'INN','INNYF','089','202605143806','2026-06-21','MV01A'],
  [2026,'INN','INNYI','218','202605143816','2026-06-13','IR01A'],
  [2026,'INN','INNYI','221','202605143819','2026-06-20','TI01A'],
  [2026,'INN','INNYJ','218','202605143825','2026-06-20','IR01A'],
  [2026,'INN','INNYK','221','202605143863','2026-06-03','TI01A'],
  [2026,'INN','INNYK','089','202605143831','2026-06-04','TI01A'],
  [2026,'INN','INNYK','218','202605143847','2026-06-07','MV01A'],
  [2026,'INN','INNYK','218','202605143851','2026-06-12','IR01A'],
  [2026,'INN','INNYK','040','202605143828','2026-06-18','TI01A'],
  [2026,'INN','INNYK','089','202605143837','2026-06-19','MV01A'],
  [2026,'INN','INNYL','221','202605143879','2026-06-09','MV01A'],
  [2026,'INN','INNYL','218','202605143875','2026-06-12','TI01A'],
  [2026,'INN','INNYL','089','202605143871','2026-06-19','MV01A'],
] as const;

async function main() {
  const branches = await prisma.branch.findMany({ select: { id: true, branchCode: true } });
  const branchMap = new Map(branches.map((b) => [b.branchCode, b.id]));

  const smCache = new Map<string, string>();
  const expiryAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  let created = 0, skipped = 0;
  const missingBranches = new Set<string>();

  for (const [chassisYear, model, suffix, colour, chassisNumber, assignmentDateStr, branchCode] of ROWS) {
    const branchId = branchMap.get(branchCode);
    if (!branchId) { missingBranches.add(branchCode); skipped++; continue; }

    // Get SM for branch (cached)
    let smId = smCache.get(branchId);
    if (!smId) {
      const sm = await prisma.user.findFirst({
        where: { branchId, role: 'SALES_MANAGER' },
        select: { id: true },
      });
      if (!sm) { missingBranches.add(branchCode); skipped++; continue; }
      smId = sm.id;
      smCache.set(branchId, smId);
    }

    const existing = await prisma.vehicle.findUnique({ where: { chassisNumber } });
    if (existing) { console.log(`⚠️  Already exists: ${chassisNumber}`); skipped++; continue; }

    const vehicle = await prisma.vehicle.create({
      data: {
        chassisNumber,
        chassisYear: Number(chassisYear),
        model,
        suffix,
        colour,
        stockStatus: 'MDDP',
        status: 'HARD_BLOCKED',
        assignmentDate: new Date(assignmentDateStr),
      },
    });

    await prisma.blockingRequest.create({
      data: {
        vehicleId: vehicle.id,
        userId: smId,
        branchId,
        blockType: 'HARD',
        status: 'ACTIVE',
        hardBlockAt: now,
        expiryAt,
      },
    });

    created++;
  }

  console.log(`✅ Created: ${created} vehicles + blockings`);
  console.log(`⚠️  Skipped: ${skipped}`);
  if (missingBranches.size) console.log(`Missing branches: ${[...missingBranches].join(', ')}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
