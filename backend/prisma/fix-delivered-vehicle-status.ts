import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  // Vehicles with a DELIVERED blocking but vehicle.status != DELIVERED
  const leaked = await prisma.$queryRaw<{ id: string; chassisNumber: string; vehicleStatus: string }[]>`
    SELECT DISTINCT v.id, v."chassisNumber", v.status as "vehicleStatus"
    FROM "Vehicle" v
    JOIN "BlockingRequest" b ON b."vehicleId" = v.id AND b.status = 'DELIVERED'
    WHERE v.status != 'DELIVERED'
  `;

  console.log(`Found ${leaked.length} vehicle(s) to fix:`);
  for (const r of leaked) {
    console.log(`  vehicle=${r.id}  chassis=${r.chassisNumber}  currentStatus=${r.vehicleStatus}`);
  }

  for (const r of leaked) {
    // Expire any active blockings on this vehicle first
    const expired = await prisma.blockingRequest.updateMany({
      where: { vehicleId: r.id, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
    if (expired.count > 0) {
      console.log(`  → Expired ${expired.count} ACTIVE blocking(s) on vehicle ${r.id}`);
    }

    // Set vehicle status to DELIVERED
    await prisma.vehicle.update({
      where: { id: r.id },
      data: { status: 'DELIVERED' },
    });
    console.log(`  → Vehicle ${r.id} (${r.chassisNumber}) → DELIVERED`);
  }

  console.log('\nDone.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
