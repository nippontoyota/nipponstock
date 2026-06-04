import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  // 1. Current vehicle status
  const v = await prisma.vehicle.findUnique({
    where: { id: '9874802' },
    select: { id: true, chassisNumber: true, status: true, model: true, suffix: true, colour: true },
  });
  console.log('Vehicle:', v);

  // 2. How many vehicles have a DELIVERED blocking but vehicle.status != DELIVERED?
  const leaked = await prisma.$queryRaw<{ id: string; chassisNumber: string; vehicleStatus: string; cnt: bigint }[]>`
    SELECT v.id, v."chassisNumber", v.status as "vehicleStatus", COUNT(b.id) as cnt
    FROM "Vehicle" v
    JOIN "BlockingRequest" b ON b."vehicleId" = v.id AND b.status = 'DELIVERED'
    WHERE v.status != 'DELIVERED'
    GROUP BY v.id, v."chassisNumber", v.status
    ORDER BY cnt DESC
    LIMIT 30
  `;
  console.log(`\nVehicles with DELIVERED blocking but non-DELIVERED vehicle.status: ${leaked.length}`);
  for (const r of leaked) {
    console.log(`  vehicle=${r.id}  chassis=${r.chassisNumber}  vehicleStatus=${r.vehicleStatus}  deliveredBlockings=${r.cnt}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
