import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  // Get all MDDP active blockings
  const blockings = await prisma.blockingRequest.findMany({
    where: {
      status: 'ACTIVE',
      blockType: 'HARD',
      vehicle: { stockStatus: 'MDDP' },
    },
    select: { id: true, branchId: true },
  });

  console.log(`Found ${blockings.length} MDDP blockings to fix`);

  // Cache branch → first SM
  const branchSmCache = new Map<string, string>();

  let updated = 0;
  let noSm = 0;
  const missingBranches: string[] = [];

  for (const b of blockings) {
    let smId = branchSmCache.get(b.branchId);

    if (!smId) {
      const sm = await prisma.user.findFirst({
        where: { branchId: b.branchId, role: 'SALES_MANAGER' },
        select: { id: true },
      });
      if (!sm) {
        noSm++;
        missingBranches.push(b.branchId);
        continue;
      }
      smId = sm.id;
      branchSmCache.set(b.branchId, smId);
    }

    await prisma.blockingRequest.update({
      where: { id: b.id },
      data: { userId: smId },
    });
    updated++;
  }

  console.log(`✅ Updated: ${updated}`);
  if (noSm > 0) console.log(`⚠️  No SM found for ${noSm} blockings, branch IDs: ${[...new Set(missingBranches)].join(', ')}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
