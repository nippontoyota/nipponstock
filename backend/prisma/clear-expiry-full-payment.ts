import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.blockingRequest.count({
    where: { status: 'ACTIVE', paymentStatus: 'Full Payment Received', expiryAt: { not: null } },
  });
  console.log(`Active 'Full Payment Received' blockings with expiryAt set: ${count}`);

  const result = await prisma.blockingRequest.updateMany({
    where: { status: 'ACTIVE', paymentStatus: 'Full Payment Received', expiryAt: { not: null } },
    data: { expiryAt: null },
  });

  console.log(`Cleared expiryAt for ${result.count} records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
