import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const loginId = 'fh.nippon';
  const password = 'FinHead@2025';
  const existing = await prisma.user.findUnique({ where: { loginId } });
  if (existing) { console.log('Account already exists:', loginId); return; }

  await prisma.user.create({
    data: {
      loginId,
      passwordHash: await bcrypt.hash(password, 10),
      fullName: 'Finance Head',
      role: 'FINANCE_HEAD',
      branchId: null,
      isActive: true,
    },
  });
  console.log('\n✅ Finance Head account created');
  console.log('   Login ID :', loginId);
  console.log('   Password :', password);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
