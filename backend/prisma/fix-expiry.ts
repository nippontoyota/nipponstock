import { PrismaClient } from '@prisma/client';

// Use direct URL to bypass PgBouncer
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const newExpiry = new Date('2026-06-02T23:59:59.000Z');
  const cutoff   = new Date('2026-06-02T23:59:59.000Z');

  // Preview first
  const toUpdate = await prisma.blockingRequest.findMany({
    where: {
      status: 'ACTIVE',
      expiryAt: { lt: cutoff },
    },
    select: { id: true, expiryAt: true, branch: { select: { branchCode: true } } },
  });

  console.log(`Found ${toUpdate.length} active blockings with expiryAt < 2026-06-02 23:59:59 UTC`);
  for (const r of toUpdate) {
    console.log(`  ${r.id}  branch=${r.branch.branchCode}  expiryAt=${r.expiryAt?.toISOString()}`);
  }

  if (toUpdate.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  const result = await prisma.blockingRequest.updateMany({
    where: {
      status: 'ACTIVE',
      expiryAt: { lt: cutoff },
    },
    data: { expiryAt: newExpiry },
  });

  console.log(`\nUpdated ${result.count} records → expiryAt = 2026-06-02T23:59:59Z`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
