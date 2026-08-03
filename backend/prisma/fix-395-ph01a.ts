import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const ph = await prisma.branch.findFirstOrThrow({ where: { branchCode: 'PH01A' } });
  const sm = await prisma.user.findFirstOrThrow({ where: { branchId: ph.id, role: 'SALES_MANAGER' } });
  const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { chassisNumber: '202606118395' } });

  const updated = await prisma.blockingRequest.updateMany({
    where: { vehicleId: vehicle.id, status: 'ACTIVE' },
    data: { branchId: ph.id, userId: sm.id },
  });

  console.log(`✅ Updated ${updated.count} blocking(s) for 202606118395 → PH01A (SM: ${sm.id})`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
