import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.findFirst({ where: { branchCode: 'KT01B' } });
  console.log('Branch KT01B:', JSON.stringify(branch, null, 2));

  if (branch) {
    const users = await prisma.user.findMany({
      where: { branchId: branch.id, role: 'SALES_MANAGER' },
      select: { id: true, fullName: true, loginId: true, role: true, isActive: true },
    });
    console.log('SMs in KT01B:', JSON.stringify(users, null, 2));
  }

  // Also search by name
  const dhanesh = await prisma.user.findMany({
    where: { fullName: { contains: 'Dhanesh', mode: 'insensitive' } },
    select: { id: true, fullName: true, loginId: true, role: true, branchId: true, isActive: true },
  });
  console.log('Dhanesh search:', JSON.stringify(dhanesh, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
