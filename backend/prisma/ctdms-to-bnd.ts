import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.vehicle.count({ where: { stockStatus: 'CTDMS' } });
  console.log(`CTDMS vehicles found: ${count}`);

  const result = await prisma.vehicle.updateMany({
    where: { stockStatus: 'CTDMS' },
    data: { stockStatus: 'BND' },
  });

  console.log(`Updated: ${result.count} vehicles → stockStatus = BND`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
