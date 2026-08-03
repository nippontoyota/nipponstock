import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

// old (current in DB) → new (correct value)
const REPLACEMENTS: [string, string][] = [
  ['202605143795', 'ST5260719484'],
  ['202605143797', 'ST5260719485'],
  ['ST5260611774', 'ST5260722129'],
  ['202605143663', 'ST5260722104'],
  ['202605143664', 'ST5260722105'],
  ['202605143526', 'ST5260720434'],
  ['202605143528', 'ST5260719707'],
  ['202605143529', 'ST5260719708'],
  ['202605143536', 'ST5260720436'],
  ['202605143537', 'ST5260719710'],
  ['202605143538', 'ST5260719711'],
];

async function main() {
  let updated = 0, notFound = 0;

  for (const [current, correct] of REPLACEMENTS) {
    const vehicle = await prisma.vehicle.findUnique({ where: { chassisNumber: current } });
    if (!vehicle) {
      console.log(`⚠️  Not found: ${current} — skipped`);
      notFound++;
      continue;
    }
    await prisma.vehicle.update({
      where: { chassisNumber: current },
      data: { chassisNumber: correct },
    });
    console.log(`✅ ${current} → ${correct}`);
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
