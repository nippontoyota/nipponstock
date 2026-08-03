import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const USERS = [
  { fullName: 'Venu Unnikrishnan',  loginId: 'venu.co01a' },
  { fullName: 'Suveesh S M',        loginId: 'suveesh.co01a' },
  { fullName: 'Shejeer T M',        loginId: 'shejeer.co01a' },
  { fullName: 'Vinod K B',          loginId: 'vinod.co01a' },
  { fullName: 'Saju Paul V',        loginId: 'saju.co01a' },
  { fullName: 'Abhijith V',         loginId: 'abhijith.co01a' },
  { fullName: 'Sajeesh Chandran K C', loginId: 'sajeesh.co01a' },
];

const DEFAULT_PASSWORD = 'Nippon@1234';

async function main() {
  const branch = await prisma.branch.findFirstOrThrow({ where: { branchCode: 'CO01A' }, select: { id: true, name: true } });
  console.log(`Branch: ${branch.name} (${branch.id})`);

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { loginId: u.loginId },
      update: {},
      create: {
        loginId: u.loginId,
        passwordHash: hash,
        fullName: u.fullName,
        role: 'SALES_MANAGER',
        branchId: branch.id,
      },
    });
    console.log(`✅ ${u.fullName} — loginId: "${u.loginId}"  password: "${DEFAULT_PASSWORD}"  id: ${user.id}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
