import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  // Blockings that expired because expiryAt passed (not manually released/delivered)
  // Indicators: status=EXPIRED, blockType=HARD, expiryAt is not null
  const expired = await prisma.blockingRequest.findMany({
    where: {
      status: 'EXPIRED',
      blockType: 'HARD',
      expiryAt: { not: null },
    },
    orderBy: { expiryAt: 'desc' },
    select: {
      id: true,
      expiryAt: true,
      hardBlockAt: true,
      paymentStatus: true,
      paymentMode: true,
      customerName: true,
      orderId: true,
      vehicle: { select: { chassisNumber: true, model: true, suffix: true, colour: true, stockStatus: true } },
      branch: { select: { name: true, branchCode: true } },
      user: { select: { fullName: true } },
    },
  });

  console.log(`Total HARD blockings expired by date: ${expired.length}\n`);

  // Group by branch
  const byBranch = new Map<string, number>();
  for (const b of expired) {
    const key = b.branch.branchCode ?? b.branch.name;
    byBranch.set(key, (byBranch.get(key) ?? 0) + 1);
  }

  console.log('── By Branch ──');
  for (const [branch, count] of [...byBranch.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${branch}: ${count}`);
  }

  // Show last 20
  console.log('\n── Last 20 expired ──');
  for (const b of expired.slice(0, 20)) {
    console.log(`  ${b.id}`);
    console.log(`    chassis=${b.vehicle.chassisNumber}  model=${b.vehicle.model}/${b.vehicle.suffix}  branch=${b.branch.branchCode}  user=${b.user.fullName}`);
    console.log(`    blockedAt=${b.hardBlockAt}  expiryAt=${b.expiryAt}  paymentStatus=${b.paymentStatus ?? '—'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
