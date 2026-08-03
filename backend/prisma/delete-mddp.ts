import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    where: { stockStatus: 'MDDP' },
    select: { id: true, chassisNumber: true },
  });

  console.log(`Found ${vehicles.length} MDDP vehicles`);
  if (!vehicles.length) { await prisma.$disconnect(); return; }

  const vehicleIds = vehicles.map((v) => v.id);

  // Delete blockings (FinanceRecord cascades automatically)
  const deletedBlockings = await prisma.blockingRequest.deleteMany({
    where: { vehicleId: { in: vehicleIds } },
  });
  console.log(`🗑  Deleted ${deletedBlockings.count} blockings (+ cascaded finance records)`);

  // Delete vehicles
  const deletedVehicles = await prisma.vehicle.deleteMany({
    where: { id: { in: vehicleIds } },
  });
  console.log(`🗑  Deleted ${deletedVehicles.count} vehicles`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
