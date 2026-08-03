import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const ROWS = [
  [2026,'FRN','FRN1L','2PS','202605143672','2026-06-09','TR01C'],
  [2026,'FRN','FRN1L','2PS','202605143676','2026-06-17','TR01A'],
  [2026,'FRN','FRN1L','2PS','202605143679','2026-06-21','KL01A'],
  [2026,'FRN','FRNB6','2UE','202605143684','2026-06-03','TR01A'],
  [2026,'FRN','FRNB6','2UE','202605143687','2026-06-20','KL01A'],
  [2026,'FRN','FRNBK','089','202605143692','2026-06-30','TR01C'],
  [2026,'FRN','FRNBM','218','202605143698','2026-06-04','TR01A'],
  [2026,'FRN','FRNBM','089','202605143696','2026-06-20','TR01A'],
  [2026,'IMV','IMVI8','040','ST5260617028','2026-06-12','KL01A'],
  [2026,'IMV','IMVIS','218','ST5260616864','2026-06-14','KL01A'],
  [2026,'IMV','IMVIS','089','ST5260616830','2026-06-30','TR01C'],
  [2026,'IMV','IMVIT','218','ST5260617603','2026-06-14','TR01C'],
  [2026,'IMV','IMVIT','089','ST5260617537','2026-06-19','TR01A'],
  [2026,'IMV','IMVIU','218','ST5260617226','2026-06-05','TR01A'],
  [2026,'IMV','IMVIU','4V8','ST5260617242','2026-06-05','TR01C'],
  [2026,'IMV','IMVIU','040','ST5260617649','2026-06-19','TR01C'],
  [2026,'IMV','IMVIU','040','ST5260617648','2026-06-20','TR01C'],
  [2026,'IMV','IMVI6','089','ST5260617706','2026-06-06','KL01A'],
  [2026,'IMV','IMVIO','218','ST5260611781','2026-06-16','TR01A'],
  [2026,'INN','INNHZ','2PS','202605143709','2026-06-04','KL01A'],
  [2026,'INN','INNHZ','2PS','202605143710','2026-06-05','KL01A'],
  [2026,'INN','INNHZ','2PS','202605143711','2026-06-07','KL01A'],
  [2026,'INN','INNHZ','2PS','202605143712','2026-06-09','TR01C'],
  [2026,'INN','INNHZ','2PS','202605143713','2026-06-10','TR01A'],
  [2026,'INN','INNHZ','2UE','202605143723','2026-06-14','TR01A'],
  [2026,'INN','INNHZ','2PS','ST5260616147','2026-06-17','TR01A'],
  [2026,'INN','INNHZ','2PS','ST5260616148','2026-06-17','TR01A'],
  [2026,'INN','INNHZ','2PS','ST5260616149','2026-06-17','TR01C'],
  [2026,'INN','INNHZ','2UE','ST5260616160','2026-06-17','TR01C'],
  [2026,'INN','INNHZ','2PS','202605143719','2026-06-18','TR01C'],
  [2026,'INN','INNHZ','2UE','202605143724','2026-06-20','KL01A'],
  [2026,'INN','INNYA','218','202605143755','2026-06-03','TR01A'],
  [2026,'INN','INNYA','040','202605143726','2026-06-05','KL01A'],
  [2026,'INN','INNYA','218','202605143761','2026-06-11','TR01A'],
  [2026,'INN','INNYA','221','202605143776','2026-06-13','TR01A'],
  [2026,'INN','INNYA','218','202605143764','2026-06-16','KL01A'],
  [2026,'INN','INNYA','089','ST5260616167','2026-06-17','TR01C'],
  [2026,'INN','INNYA','089','ST5260616168','2026-06-17','TR01A'],
  [2026,'INN','INNYA','089','ST5260616171','2026-06-17','TR01A'],
  [2026,'INN','INNYA','221','ST5260616179','2026-06-17','TR01C'],
  [2026,'INN','INNYA','040','202605143730','2026-06-18','TR01A'],
  [2026,'INN','INNYA','218','202605143766','2026-06-18','TR01C'],
  [2026,'INN','INNYA','089','202605143736','2026-06-20','TR01C'],
  [2026,'INN','INNYA','089','202605143737','2026-06-20','TR01A'],
  [2026,'INN','INNYA','089','202605143738','2026-06-21','KL01A'],
  [2026,'INN','INNYB','1D6','202605143781','2026-06-13','KL01A'],
  [2026,'INN','INNYD','040','202605143787','2026-06-19','TR01C'],
  [2026,'INN','INNYE','218','202605143801','2026-06-19','TR01A'],
  [2026,'INN','INNYF','4V8','202605143809','2026-06-08','KL01A'],
  [2026,'INN','INNYI','218','202605143817','2026-06-18','KL01A'],
  [2026,'INN','INNYI','089','ST5260616199','2026-06-18','KL01A'],
  [2026,'INN','INNYJ','040','202605143820','2026-06-19','TR01C'],
  [2026,'INN','INNYK','218','202605143844','2026-06-04','KL01A'],
  [2026,'INN','INNYK','218','202605143846','2026-06-07','KL01A'],
  [2026,'INN','INNYK','089','202605143833','2026-06-10','TR01C'],
  [2026,'INN','INNYK','221','202605143865','2026-06-10','TR01A'],
  [2026,'INN','INNYK','089','202605143835','2026-06-14','TR01A'],
  [2026,'INN','INNYK','218','202605143856','2026-06-18','TR01A'],
  [2026,'INN','INNYK','218','202605143857','2026-06-18','TR01A'],
  [2026,'INN','INNYK','218','202605143858','2026-06-20','TR01C'],
  [2026,'INN','INNYK','089','202605143839','2026-06-21','KL01A'],
  [2026,'INN','INNYK','218','202605143859','2026-06-21','TR01C'],
  [2026,'INN','INNYK','221','202605143866','2026-06-21','TR01C'],
  [2026,'INN','INNYL','218','202605143877','2026-06-21','KL01A'],
  [2026,'HLX','HLXX4','089','202605143701','2026-06-14','KL01A'],
  [2026,'FRN','FRN1L','2PS','202605143673','2026-06-12','KT01A'],
  [2026,'FRN','FRN1L','2PS','202605143677','2026-06-19','KT01A'],
  [2026,'FRN','FRN4L','2PS','202605143680','2026-06-04','KT01A'],
  [2026,'FRN','FRNB6','2PS','202605143682','2026-06-21','PH01A'],
  [2026,'FRN','FRNBK','089','202605143690','2026-06-09','PH01A'],
  [2026,'IMV','IMVI8','040','ST5260617030','2026-06-09','KT01A'],
  [2026,'IMV','IMVI8','040','ST5260617029','2026-06-19','TL01A'],
  [2026,'IMV','IMVIS','089','ST5260616831','2026-06-17','KT01A'],
  [2026,'IMV','IMVIT','1D6','ST5260617594','2026-06-13','PH01A'],
  [2026,'IMV','IMVIU','089','ST5260617184','2026-06-04','PH01A'],
  [2026,'IMV','IMVIU','089','ST5260617182','2026-06-19','KT01A'],
  [2026,'IMV','IMVIV','089','ST5260617325','2026-06-21','TL01A'],
  [2026,'IMV','IMVIW','040','ST5260617384','2026-06-10','KT01A'],
  [2026,'INN','INND4','089','202605143706','2026-06-07','TL01A'],
  [2026,'INN','INNYA','218','202605143758','2026-06-07','PH01A'],
  [2026,'INN','INNYA','218','202605143760','2026-06-10','KT01A'],
  [2026,'INN','INNYA','089','ST5260616166','2026-06-17','KT01A'],
  [2026,'INN','INNYA','221','ST5260616177','2026-06-17','PH01A'],
  [2026,'INN','INNYA','221','ST5260616180','2026-06-17','KT01A'],
  [2026,'INN','INNYA','218','202605143769','2026-06-20','PH01A'],
  [2026,'INN','INNYA','221','202605143778','2026-06-20','PH01A'],
  [2026,'INN','INNYA','089','202605143740','2026-06-21','KT01A'],
  [2026,'INN','INNYA','218','202605143770','2026-06-21','KT01A'],
  [2026,'INN','INNYB','040','ST5260616181','2026-06-17','TR01A'],
  [2026,'INN','INNYE','089','202605143793','2026-06-03','PH01A'],
  [2026,'INN','INNYF','089','202605143805','2026-06-03','TL01A'],
  [2026,'INN','INNYI','089','202605143811','2026-06-04','KT01A'],
  [2026,'INN','INNYI','089','202605143812','2026-06-20','PH01A'],
  [2026,'INN','INNYJ','089','202605143822','2026-06-20','KT01A'],
  [2026,'INN','INNYK','218','202605143845','2026-06-05','PH01A'],
  [2026,'INN','INNYK','221','202605143864','2026-06-07','TL01A'],
  [2026,'INN','INNYK','218','202605143848','2026-06-08','PH01A'],
  [2026,'INN','INNYK','218','202605143852','2026-06-12','KT01A'],
  [2026,'INN','INNYK','218','202605143853','2026-06-13','KT01A'],
  [2026,'INN','INNYK','089','202605143836','2026-06-18','TL01A'],
  [2026,'INN','INNYK','089','202605143838','2026-06-20','PH01A'],
  [2026,'INN','INNYL','218','202605143874','2026-06-05','KT01A'],
  [2026,'INN','INNYL','221','202605143881','2026-06-21','PH01A'],
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
