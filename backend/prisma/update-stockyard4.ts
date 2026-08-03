import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;

const UPDATES: [string, string][] = [
  ['MBHJWC13STFD26473','KT01A'],['MBJUYMM1STE217855','KT01A'],['MBJUYML1STE223532','KT01A'],
  ['MBJUYMM1STD215211','KT01A'],['MBJUYMM1STE217726','KT01A'],['MBJUYMM1STD216427','KT01A'],
  ['MBJUYML1SSL193820','KT01A'],['MBJAABAA601435371~0726','KT01A'],['MBJJB8EM101712657~0626','KT01A'],
  ['MBJAB3EM904585304~0726','KT01A'],['MBJJB8EM201713591~0726','KT01A'],['MBJJB8EM901713216~0726','KT01A'],
  ['MBJJB8EM201712750~0626','KT01A'],['MBJAABAA301434713~0626','KT01A'],['MBJABBAA301541483~1225','KT01A'],
  ['MBJAB3EM504585302~0726','KT01A'],['MBJAA3GS000667251~0626','KT01A'],['MBJJB8EM301711073~0526','KT01A'],
  ['MBJUYML1SSJ183146','TI01A'],['MBHLWF13STF907622','TI01A'],['MBJABBAA101568262~0526','TI01A'],
  ['MBJUYML1SSJ184739','TI01A'],['MBHJWC13SSKB43647','TI01A'],['MBJUYML1SSL193827','TI01A'],
  ['MBJUYML1STA199803','TI01A'],
  ['MBHJWC13SSLB45057','IR01A'],['MBHJWC13SSKB41315','IR01A'],['MBJABBAA501571116~0626','IR01A'],
  ['MBJAABAA201433889~0626','CO01B'],['MBJABBAAX01572987~0726','CO01B'],['MBJUYMM1STE219019','CO01B'],
  ['MBJUYMM1STD215734','CO01B'],['MBJUYMM1STD216429','CO01B'],['MBJUYMM1STD215481','CO01B'],
  ['MBHLWF13STF909809','KL01A'],['MBJAABAA501434695~0626','KL01A'],['MBJAC3AK702004167~0726','KL01A'],
  ['MBJAABAA001435298~0726','KL01A'],['MBJAABAA301435151~0726','KL01A'],['MBJAABAA601435113~0726','KL01A'],
  ['MBJAABAA801435288~0726','KL01A'],['MBJABBAA301574614~0726','KL01A'],['MBJAABAA701435511~0726','KL01A'],
  ['MBJAABAA501435376~0726','KL01A'],['MBJAABAAX01434675~0626','KL01A'],['MBJAABAA801435176~0726','KL01A'],
  ['MBJAABAA601435385~0726','KL01A'],['MBJABBAA701574437~0726','KL01A'],
];

const BATCH = 10;

async function runBatch(items: [string, string][], batchNum: number) {
  const prisma = new PrismaClient();
  try {
    const caseWhen = items.map(([cn, loc]) => `WHEN '${cn.replace(/'/g, "''")}' THEN '${loc}'`).join('\n  ');
    const inList = items.map(([cn]) => `'${cn.replace(/'/g, "''")}'`).join(', ');
    const sql = `UPDATE "Vehicle" SET "stockyardLocation" = CASE "chassisNumber"\n  ${caseWhen}\n  ELSE "stockyardLocation"\nEND\nWHERE "chassisNumber" IN (${inList})`;
    await prisma.$executeRawUnsafe(sql);
    console.log(`Batch ${batchNum}: ok (${items.length} items)`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log(`Total: ${UPDATES.length} items`);
  let batchNum = 1;
  for (let i = 0; i < UPDATES.length; i += BATCH) {
    const batch = UPDATES.slice(i, i + BATCH);
    await runBatch(batch, batchNum++);
    if (i + BATCH < UPDATES.length) await new Promise(r => setTimeout(r, 800));
  }
  console.log('\nAll done.');
}
main().catch((e) => { console.error(e); process.exit(1); });
