import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const CHASSIS_NUMBERS = [
  '202605143149','202605143704','202605143138','202605143369','202605143555',
  '202605143576','202605143560','202605143270','202605143702','202605143495',
  '202605143569','202605143575','202605143539','ST5260616386','ST5260613758',
  'ST5260613759','ST5260613614','ST5260613757','ST5260613618','ST5260613743',
  'ST5260613746','202605143703','ST5260615603','ST5260615077','202605143501',
  '202605143568','ST5260613753','202605143662','ST5260613611','202605143133',
  'ST5260613752','ST5260613626','202605143494','ST5260613905','202605143497',
  'ST5260616100','ST5260615812','ST5260616222','ST5260616283','202605143574',
  'ST5260613448','202605143567','ST5260616116','ST5260613374','ST5260611064',
  'ST5260611066','ST5260611065','ST5260613609','202605143660','ST5260613610',
  'ST5260613721','ST5260613504','ST5260613460','ST5260613461','ST5260613462',
  'ST5260613463','202605143554','ST5260613502','ST5260613663','ST5260613533',
  '202605143701','202605143712','202605143711','202605143782','202605143373',
  '202605143531','ST5260613484','ST5260616341','202605143573','ST5260615440',
  'ST5260615200','ST5260613481','ST5260613482','ST5260615836','ST5260613593',
  'ST5260613723','ST5260613671','ST5260613483','ST5260614172','ST5260613653',
  'ST5260613652','ST5260613297','ST5260613318','ST5260613881','ST5260615781',
  'ST5260613332','202604192637','202604192435',
];

async function main() {
  let deleted = 0, notFound = 0;

  for (const chassisNumber of CHASSIS_NUMBERS) {
    const vehicle = await prisma.vehicle.findUnique({ where: { chassisNumber } });
    if (!vehicle) {
      console.log(`⚠️  Not found: ${chassisNumber}`);
      notFound++;
      continue;
    }

    const blockingsDeleted = await prisma.blockingRequest.deleteMany({ where: { vehicleId: vehicle.id } });
    await prisma.vehicle.delete({ where: { chassisNumber } });

    console.log(`✅ Deleted: ${chassisNumber}${blockingsDeleted.count > 0 ? ` (+ ${blockingsDeleted.count} blocking(s))` : ''}`);
    deleted++;
  }

  console.log(`\nDone: ${deleted} vehicles deleted, ${notFound} not found`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
