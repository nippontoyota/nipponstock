import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const MDDP_DAYS = 30;
const DEFAULT_DAYS = 10; // matches globalConfig default_blocking_days

function hardBlockExpiryFrom(baseDate: Date, days: number): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const baseIst = new Date(baseDate.getTime() + IST_OFFSET_MS);
  const expiryMidnightIst = Date.UTC(
    baseIst.getUTCFullYear(),
    baseIst.getUTCMonth(),
    baseIst.getUTCDate() + days,
  );
  return new Date(expiryMidnightIst - IST_OFFSET_MS + 23 * 60 * 60 * 1000);
}

async function main() {
  // Find all ACTIVE hard blockings where expiryAt is more than 30 days after hardBlockAt
  // (anything above 30 days is wrong since MDDP is the max at 30 days)
  const blockings = await prisma.blockingRequest.findMany({
    where: {
      blockType: 'HARD',
      status: 'ACTIVE',
      paymentStatus: { not: 'Full Payment Received' }, // null expiryAt = skip
    },
    select: {
      id: true,
      hardBlockAt: true,
      expiryAt: true,
      vehicle: { select: { stockStatus: true } },
    },
  });

  let fixed = 0;
  let skipped = 0;

  for (const b of blockings) {
    if (!b.hardBlockAt || !b.expiryAt) { skipped++; continue; }

    const days = b.vehicle.stockStatus === 'MDDP' ? MDDP_DAYS : DEFAULT_DAYS;
    const correctExpiry = hardBlockExpiryFrom(new Date(b.hardBlockAt), days);
    const currentExpiry = new Date(b.expiryAt);

    // Only fix if current expiryAt differs by more than 1 day from correct value
    const diffMs = Math.abs(currentExpiry.getTime() - correctExpiry.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 1) { skipped++; continue; }

    console.log(
      `Fix ${b.id.slice(0, 8)}: stockStatus=${b.vehicle.stockStatus} hardBlockAt=${new Date(b.hardBlockAt).toISOString().slice(0, 10)} ` +
      `current expiryAt=${currentExpiry.toISOString().slice(0, 10)} → correct=${correctExpiry.toISOString().slice(0, 10)}`
    );

    await prisma.blockingRequest.update({
      where: { id: b.id },
      data: { expiryAt: correctExpiry },
    });
    fixed++;
  }

  console.log(`\n✅ Fixed ${fixed} blockings. Skipped ${skipped} (already correct or null expiryAt).`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
