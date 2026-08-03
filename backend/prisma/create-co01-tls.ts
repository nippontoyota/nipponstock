import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const USERS: { fullName: string; branchCode: string }[] = [
  // Kalamaserry — CO01B
  { fullName: 'Binoj T L',              branchCode: 'CO01B' },
  { fullName: 'Jaikumar Viswambaren',   branchCode: 'CO01B' },
  { fullName: 'Sanofal V L',            branchCode: 'CO01B' },
  { fullName: 'Ryan George',            branchCode: 'CO01B' },
  { fullName: 'Daison Davis',           branchCode: 'CO01B' },
  { fullName: 'Bibin Baby A',           branchCode: 'CO01B' },
  // Nettoor — CO01A
  { fullName: 'Venu Unnikrishnan',      branchCode: 'CO01A' },
  { fullName: 'Suveesh S M',            branchCode: 'CO01A' },
  { fullName: 'Shejeer T M',            branchCode: 'CO01A' },
  { fullName: 'Vinod K B',              branchCode: 'CO01A' },
  { fullName: 'Saju Paul V',            branchCode: 'CO01A' },
  { fullName: 'Abhijith V',             branchCode: 'CO01A' },
  { fullName: 'Sajeesh Chandran K C',   branchCode: 'CO01A' },
];

function makeLoginId(fullName: string, branchCode: string): string {
  const first = fullName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  return `${first}.${branchCode.toLowerCase()}`;
}

function jumblePassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#$!';
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars = [pick(upper), pick(upper), pick(lower), pick(lower), pick(lower), pick(digits), pick(digits), pick(special)];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  const branches = await prisma.branch.findMany({ select: { id: true, branchCode: true, name: true } });
  const branchMap = new Map(branches.map((b) => [b.branchCode, { id: b.id, name: b.name }]));

  console.log('\nName | Login ID | Password | Branch');
  console.log('-----|----------|----------|-------');

  for (const u of USERS) {
    const branch = branchMap.get(u.branchCode);
    if (!branch) { console.log(`⚠️  Branch not found: ${u.branchCode} for ${u.fullName}`); continue; }

    const loginId = makeLoginId(u.fullName, u.branchCode);
    const password = jumblePassword();
    const hash = await bcrypt.hash(password, 12);

    await prisma.user.upsert({
      where: { loginId },
      update: { role: 'TEAM_LEADER', passwordHash: hash, fullName: u.fullName.trim(), branchId: branch.id },
      create: {
        loginId,
        passwordHash: hash,
        fullName: u.fullName.trim(),
        role: 'TEAM_LEADER',
        branchId: branch.id,
      },
    });

    console.log(`${u.fullName} | ${loginId} | ${password} | ${branch.name}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
