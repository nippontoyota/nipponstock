import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  // Find vehicles that have BOTH a DELIVERED blocking AND an ACTIVE blocking
  const affected = await prisma.$queryRaw<{
    vehicleId: string;
    chassisNumber: string;
    vehicleStatus: string;
    activeBlockingId: string;
    activeUserId: string;
    activeBranch: string;
    deliveredBlockingId: string;
  }[]>`
    SELECT
      v.id            AS "vehicleId",
      v."chassisNumber",
      v.status        AS "vehicleStatus",
      ab.id           AS "activeBlockingId",
      ab."userId"     AS "activeUserId",
      br.name         AS "activeBranch",
      db.id           AS "deliveredBlockingId"
    FROM "Vehicle" v
    JOIN "BlockingRequest" ab ON ab."vehicleId" = v.id AND ab.status = 'ACTIVE' AND ab."blockType" = 'HARD'
    JOIN "BlockingRequest" db ON db."vehicleId" = v.id AND db.status = 'DELIVERED'
    JOIN "Branch" br ON br.id = ab."branchId"
    ORDER BY v.id
  `;

  if (affected.length === 0) {
    console.log('✅ No vehicles found with both an ACTIVE blocking and a DELIVERED blocking.');
    return;
  }

  console.log(`⚠️  Found ${affected.length} vehicle(s) with an ACTIVE blocking on an already-DELIVERED vehicle:\n`);
  for (const r of affected) {
    console.log(`  vehicle=${r.vehicleId}  chassis=${r.chassisNumber}  vehicleStatus=${r.vehicleStatus}`);
    console.log(`    ACTIVE  blocking=${r.activeBlockingId}  branch=${r.activeBranch}`);
    console.log(`    DELIVERED blocking=${r.deliveredBlockingId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
