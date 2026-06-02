import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.vehicle.count({ where: { assignmentDate: null } });
  console.log(`Vehicles with null assignmentDate: ${count}`);

  const result = await prisma.$executeRaw`
    UPDATE "Vehicle"
    SET "assignmentDate" = "createdAt"
    WHERE "assignmentDate" IS NULL
  `;
  console.log(`Updated: ${result} rows`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
