import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const [global, models] = await Promise.all([
    prisma.globalConfig.findMany(),
    prisma.modelConfig.findMany(),
  ]);
  console.log('Global config:', JSON.stringify(global, null, 2));
  console.log('Model config:', JSON.stringify(models, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
