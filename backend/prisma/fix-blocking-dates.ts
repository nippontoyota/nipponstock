import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  // Find all blockings where softBlockAt is in the future (incorrectly set to assignment date)
  const future = await prisma.blockingRequest.findMany({
    where: { softBlockAt: { gt: new Date() } },
    select: { id: true, createdAt: true, softBlockAt: true },
  });

  console.log(`Found ${future.length} blockings with future softBlockAt`);

  for (const b of future) {
    await prisma.blockingRequest.update({
      where: { id: b.id },
      data: { softBlockAt: b.createdAt, hardBlockAt: b.createdAt },
    });
  }

  console.log(`✅ Fixed ${future.length} records — set softBlockAt/hardBlockAt to createdAt`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
