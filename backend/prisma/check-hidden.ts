import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const hidden = await prisma.vehicle.findMany({
    where: { hiddenFromHeatmap: true },
    select: { chassisNumber: true, model: true, suffix: true, colour: true, status: true },
  });

  console.log(`Hidden from heatmap: ${hidden.length} vehicles`);
  hidden.forEach(v => console.log(`  ${v.chassisNumber} | ${v.model} ${v.suffix} ${v.colour} | ${v.status}`));

  // Also check if any hidden ones are OPEN (they'd be blockable if filter was missing)
  const hiddenOpen = hidden.filter(v => v.status === 'OPEN');
  console.log(`\nHidden + OPEN: ${hiddenOpen.length} (these would be soft-blockable if filter was absent)`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
