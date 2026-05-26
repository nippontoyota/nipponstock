import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. purchaseMode: 'Cash' → 'Out House'
  const r1 = await prisma.$executeRaw`
    UPDATE "FinanceRecord" SET "purchaseMode" = 'Out House' WHERE "purchaseMode" = 'Cash'
  `;
  console.log(`purchaseMode Cash → Out House: ${r1} rows updated`);

  // 2. financeStatus: 'Logged, Approval Pending' → 'Logged Approval Pending'
  const r2 = await prisma.$executeRaw`
    UPDATE "FinanceRecord" SET "financeStatus" = 'Logged Approval Pending' WHERE "financeStatus" = 'Logged, Approval Pending'
  `;
  console.log(`financeStatus Logged, Approval Pending → Logged Approval Pending: ${r2} rows updated`);

  // 3. financeStatus: 'Logged, Documents Pending' → 'Logged Document Pending'
  const r3 = await prisma.$executeRaw`
    UPDATE "FinanceRecord" SET "financeStatus" = 'Logged Document Pending' WHERE "financeStatus" = 'Logged, Documents Pending'
  `;
  console.log(`financeStatus Logged, Documents Pending → Logged Document Pending: ${r3} rows updated`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
