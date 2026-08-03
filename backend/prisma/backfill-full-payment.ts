import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.blockingRequest.findMany({
    where: {
      status: 'ACTIVE',
      paymentStatus: 'Full Payment Received',
      fullPaymentAt: null,
    },
    select: { id: true, updatedAt: true },
  });

  console.log(`Found ${records.length} active 'Full Payment Received' blockings with no fullPaymentAt`);

  for (const r of records) {
    console.log(`  ${r.id}  updatedAt=${r.updatedAt.toISOString()}`);
  }

  if (!records.length) { console.log('Nothing to update.'); return; }

  // Update each individually so we can set fullPaymentAt = that record's updatedAt
  let count = 0;
  for (const r of records) {
    await prisma.blockingRequest.update({
      where: { id: r.id },
      data: { fullPaymentAt: r.updatedAt },
    });
    count++;
  }

  console.log(`\nBackfilled fullPaymentAt for ${count} records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
