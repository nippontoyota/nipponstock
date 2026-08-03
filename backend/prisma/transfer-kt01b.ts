import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const NEW_BRANCH_ID = 'dc299734-5199-4543-bdcc-56094f495a4c'; // KT01B
const NEW_USER_ID   = '2f8bc2e6-01d0-4244-b06e-c7d7e43d5af7'; // dhanesh (SM at KT01B)

const CHASSIS = [
  'MBJUYML1STE224528',
  'MBHJWC13SSLB65007',
  'MBHLWF13STF907726',
  'MBJUYML1SSJ186302',
  'MBJAABAA601435371~0726',
  'MBJUYML1STE225385',
  'MBJUYML1STE223532',
  'MBHLWF13STF910309',
  'MBJUYML1STE224610',
  'MBJUYML1STE224209',
  'MBHLWF13STF910210',
  'MBHJWC13SSHA81715',
  'MBHJWC13SSLB46969',
  'MBJUYML1STE222885',
  'MBJJB8EM101712979~0726',
  'MBJAA3GS000668125~0726',
  'MBJAABAA701434648~0626',
  'MBJUYMM1STB206880',
  'MBJUYMM1STD216190',
  'MBHJWC13SSHA97270',
  'ST5260719719',
  'ST5260722101',
  '202606118669',
  '202606118551',
  'ST5260722053',
  '202606118500',
  '202606118518',
  '202606118485',
  '202606118438',
  '202606118483',
  '202606117993',
  '202606117846',
  '202606118308',
  'ST5260722303',
  '202606118647',
];

async function main() {
  let transferred = 0, notFound = 0, noBlocking = 0;

  for (const cn of CHASSIS) {
    const vehicle = await prisma.vehicle.findUnique({ where: { chassisNumber: cn }, select: { id: true } });
    if (!vehicle) {
      console.log(`❌ NOT FOUND: ${cn}`);
      notFound++;
      continue;
    }

    const blocking = await prisma.blockingRequest.findFirst({
      where: { vehicleId: vehicle.id, status: 'ACTIVE' },
      select: { id: true, userId: true, branchId: true },
    });
    if (!blocking) {
      console.log(`⚠️  NO ACTIVE BLOCKING: ${cn}`);
      noBlocking++;
      continue;
    }

    await prisma.blockingRequest.update({
      where: { id: blocking.id },
      data: { userId: NEW_USER_ID, branchId: NEW_BRANCH_ID },
    });
    console.log(`✅ Transferred: ${cn}`);
    transferred++;
  }

  console.log(`\nDone — transferred: ${transferred}, no active blocking: ${noBlocking}, not found: ${notFound}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
