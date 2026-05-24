/**
 * Seed Finance Officer accounts — one per branch.
 * Run:  npx tsx prisma/seed-finance.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Finance@2025';

function toLoginId(branchName: string): string {
  return 'fo.' + branchName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function main() {
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
  if (!branches.length) { console.log('No branches found — seed branches first.'); return; }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const results: { loginId: string; fullName: string; branch: string }[] = [];

  for (const branch of branches) {
    const loginId = toLoginId(branch.name);
    const fullName = `Finance Officer — ${branch.name}`;

    const existing = await prisma.user.findUnique({ where: { loginId } });
    if (existing) {
      console.log(`  SKIP  ${loginId}  (already exists)`);
      results.push({ loginId, fullName, branch: branch.name });
      continue;
    }

    await prisma.user.create({
      data: {
        loginId,
        passwordHash,
        fullName,
        role: 'FINANCE_OFFICER',
        branchId: branch.id,
        isActive: true,
      },
    });
    console.log(`  CREATE  ${loginId}  →  ${branch.name}`);
    results.push({ loginId, fullName, branch: branch.name });
  }

  console.log('\n========= FINANCE OFFICER ACCOUNTS =========');
  console.log(`Default password for all: ${PASSWORD}\n`);
  console.table(results);
  console.log('=============================================\n');
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
