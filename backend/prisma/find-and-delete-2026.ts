import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const variants = [
    '202604192435', '202604192435.00', '202604192435.0',
    '202604192637', '202604192637.00', '202604192637.0',
  ];

  for (const v of variants) {
    const found = await prisma.vehicle.findUnique({ where: { chassisNumber: v } });
    if (found) console.log(`FOUND: "${v}" → id: ${found.id}`);
  }

  // Also search by partial match
  const partial = await prisma.vehicle.findMany({
    where: { chassisNumber: { contains: '202604192' } },
    select: { chassisNumber: true, id: true },
  });
  if (partial.length) {
    console.log(`\nPartial matches for "202604192":`);
    partial.forEach(v => console.log(`  "${v.chassisNumber}"`));
  } else {
    console.log('No partial matches found for "202604192"');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
