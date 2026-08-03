import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  for (const cn of ['202604192435.00', '202604192637.00']) {
    const v = await prisma.vehicle.findUniqueOrThrow({ where: { chassisNumber: cn } });
    const b = await prisma.blockingRequest.deleteMany({ where: { vehicleId: v.id } });
    await prisma.vehicle.delete({ where: { chassisNumber: cn } });
    console.log(`✅ Deleted: ${cn}${b.count ? ` (+ ${b.count} blocking(s))` : ''}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
