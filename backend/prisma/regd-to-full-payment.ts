import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.blockingRequest.count({ where: { paymentStatus: 'Regd. In Progress' } });
  console.log(`Regd. In Progress blockings found: ${count}`);

  const result = await prisma.blockingRequest.updateMany({
    where: { paymentStatus: 'Regd. In Progress' },
    data: {
      paymentStatus: 'Full Payment Received',
      expiryAt: null,
      fullPaymentAt: new Date(),
    },
  });

  console.log(`Updated: ${result.count} → paymentStatus=Full Payment Received, expiryAt=null, fullPaymentAt=now`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
