import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const v = await prisma.vehicle.findUnique({ where: { chassisNumber: 'MA3DND72STED09803' } });
  if (!v) { console.log('Vehicle not found'); await prisma.$disconnect(); return; }
  console.log('Vehicle:', JSON.stringify(v, null, 2));

  const b = await prisma.blockingRequest.findMany({ where: { vehicleId: v.id } });
  console.log('Blockings:', JSON.stringify(b, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
