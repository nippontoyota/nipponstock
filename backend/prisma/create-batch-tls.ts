import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const USERS: { fullName: string; branchCode: string }[] = [
  { fullName: 'Shahanas A',               branchCode: 'KL01A' },
  { fullName: 'Subin V',                  branchCode: 'TR01A' },
  { fullName: 'Vinod V G Nair',           branchCode: 'TR01C' },
  { fullName: 'Sreekanth S S',            branchCode: 'TR01C' },
  { fullName: 'Ajmal Khan N',             branchCode: 'PH01A' },
  { fullName: 'Shiyas V S',               branchCode: 'MV01A' },
  { fullName: 'Ratheesh V V',             branchCode: 'IR01A' },
  { fullName: 'Smijith Appraem',          branchCode: 'TI01A' },
  { fullName: 'Dhanesh Kumar M',          branchCode: 'KT01A' },
  { fullName: 'Prasanth P',               branchCode: 'TR01A' },
  { fullName: 'Sam K Benny',              branchCode: 'TL01A' },
  { fullName: 'Libin Mathew',             branchCode: 'PH01A' },
  { fullName: 'Anoop Joy',                branchCode: 'KT01A' },
  { fullName: 'Bilbert James',            branchCode: 'KT01A' },
  { fullName: 'Faisal Rahim A',           branchCode: 'KY01A' },
  { fullName: 'Vinod Kumar Velayudhan',   branchCode: 'KY01A' },
  { fullName: 'Subeer K',                 branchCode: 'TR01A' },
  { fullName: 'Sugesh S',                 branchCode: 'KL01A' },
  { fullName: 'Krishnakumar V',           branchCode: 'TR01C' },
  { fullName: 'Ramesh T A',               branchCode: 'KT01A' },
  { fullName: 'Adithyan V S',             branchCode: 'TL01A' },
  { fullName: 'Shibin M S',               branchCode: 'IR01A' },
  { fullName: 'Prajith Prabhakaran',      branchCode: 'TI01A' },
  { fullName: 'Anoop Soman',              branchCode: 'PH01A' },
  { fullName: 'Rajesh R',                 branchCode: 'TR01A' },
  { fullName: 'Sreejith D S',             branchCode: 'TR01C' },
  { fullName: 'Movin T M',               branchCode: 'MV01A' },
  { fullName: 'Joyson C K',              branchCode: 'TI01A' },
  { fullName: 'Aju Jose',                branchCode: 'IR01A' },
  { fullName: 'Ratheesh K R',            branchCode: 'TI01A' },
  { fullName: 'Suvin M S',               branchCode: 'KT01A' },
  { fullName: 'Sumesh Nair',             branchCode: 'MV01A' },
  { fullName: 'Anish Kabeer',            branchCode: 'TR01A' },
  { fullName: 'Prasanth H',             branchCode: 'TR01C' },
  { fullName: 'Niyas N',                branchCode: 'KL01A' },
  { fullName: 'Rajeev R',               branchCode: 'KL01A' },
  { fullName: 'Albin James',            branchCode: 'IR01A' },
  { fullName: 'Deepak T M',             branchCode: 'TI01A' },
  { fullName: 'Edwin Siby',             branchCode: 'KT01A' },
  { fullName: 'Laiju C V',              branchCode: 'TI01A' },
  { fullName: 'Vijith V A',             branchCode: 'KT01A' },
  { fullName: 'Siril Das',              branchCode: 'TL01A' },
  { fullName: 'Pradeep R',              branchCode: 'KL01A' },
  { fullName: 'Basil B Thottam',        branchCode: 'MV01A' },
  { fullName: 'Anantha Krishna Menon P S', branchCode: 'MV01A' },
  { fullName: 'Mojith K M',             branchCode: 'TI01A' },
  { fullName: 'Gopakumar K',            branchCode: 'MV01A' },
  { fullName: 'Abhilash V',             branchCode: 'KT01A' },
  { fullName: 'Arun V R',               branchCode: 'KL01A' },
  { fullName: 'Arun Thomas Ariyappallil', branchCode: 'PH01A' },
  { fullName: 'Kailas S',               branchCode: 'KL01A' },
  { fullName: 'Samir K Nazzer',         branchCode: 'KT01A' },
  { fullName: 'Shijar M',               branchCode: 'KY01A' },
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
