import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

// branchCode -> ordered list of stockyard codes, nearest first
const RANKS: Record<string, string[]> = {
  PH01A: ['PH01A', 'TL01A', 'KL01A', 'KT01A', 'KY01A', 'TR01A', 'TR01C', 'MV01A', 'CO01A', 'CO01B', 'IR01A', 'TI01A'],
  KL01A: ['KL01A', 'PH01A', 'TR01A', 'TR01C', 'TL01A', 'KY01A', 'KT01A', 'MV01A', 'CO01A', 'CO01B', 'IR01A', 'TI01A'],
  IR01A: ['IR01A', 'TI01A', 'CO01B', 'CO01A', 'MV01A', 'KT01A', 'KY01A', 'TL01A', 'PH01A', 'KL01A', 'TR01A', 'TR01C'],
  CO01B: ['CO01B', 'CO01A', 'MV01A', 'IR01A', 'TI01A', 'KT01A', 'TL01A', 'KY01A', 'PH01A', 'KL01A', 'TR01A', 'TR01C'],
  KY01A: ['KY01A', 'TL01A', 'PH01A', 'KL01A', 'KT01A', 'CO01A', 'TR01A', 'TR01C', 'MV01A', 'CO01B', 'IR01A', 'TI01A'],
  MV01A: ['MV01A', 'CO01B', 'CO01A', 'KT01A', 'IR01A', 'TL01A', 'TI01A', 'PH01A', 'KY01A', 'KL01A', 'TR01A', 'TR01C'],
  KT01A: ['KT01A', 'TL01A', 'MV01A', 'CO01A', 'CO01B', 'PH01A', 'KY01A', 'KL01A', 'TI01A', 'IR01A', 'TR01A', 'TR01C'],
  CO01A: ['CO01A', 'CO01B', 'MV01A', 'KT01A', 'IR01A', 'TI01A', 'TL01A', 'KY01A', 'PH01A', 'KL01A', 'TR01A', 'TR01C'],
  TL01A: ['TL01A', 'PH01A', 'KT01A', 'KY01A', 'CO01A', 'CO01B', 'MV01A', 'KL01A', 'TR01A', 'TR01C', 'IR01A', 'TI01A'],
  TR01C: ['TR01C', 'TR01A', 'KL01A', 'PH01A', 'TL01A', 'KY01A', 'KT01A', 'MV01A', 'CO01A', 'CO01B', 'IR01A', 'TI01A'],
  TR01A: ['TR01A', 'TR01C', 'KL01A', 'PH01A', 'TL01A', 'KY01A', 'KT01A', 'MV01A', 'CO01A', 'CO01B', 'IR01A', 'TI01A'],
  TI01A: ['TI01A', 'IR01A', 'MV01A', 'CO01B', 'CO01A', 'KT01A', 'TL01A', 'KY01A', 'PH01A', 'KL01A', 'TR01A', 'TR01C'],
};

async function main() {
  const branches = await prisma.branch.findMany({ select: { id: true, branchCode: true } });
  const branchByCode = new Map(branches.map((b) => [b.branchCode, b.id]));

  let created = 0;
  const missing = new Set<string>();

  for (const [branchCode, ordered] of Object.entries(RANKS)) {
    const branchId = branchByCode.get(branchCode);
    if (!branchId) { missing.add(branchCode); continue; }

    for (let i = 0; i < ordered.length; i++) {
      const stockyardCode = ordered[i];
      const rank = i + 1;
      await prisma.stockyardRank.upsert({
        where: { branchId_stockyardCode: { branchId, stockyardCode } },
        update: { rank },
        create: { branchId, stockyardCode, rank },
      });
      created++;
    }
  }

  console.log(`✅ Upserted ${created} stockyard rank rows`);
  if (missing.size) console.log(`⚠️  Branches not found: ${[...missing].join(', ')}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
