import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;

const UPDATES: [string, string][] = [
  ['MBJAB3EM604585874~0726','KY01A'],['MBJABBAA601575143~0726','KY01A'],['MBJABBAA301574662~0726','KL01A'],
  ['MBJAABAA201435626~0726','KY01A'],['MBJBE3FS801486662~0726','KY01A'],['MBJAA3GS200668272~0726','KL01A'],
  ['MBJABBAA701575104~0726','KY01A'],['MBJABBAA001575011~0726','KL01A'],['MBJAB3EM804585813~0726','KY01A'],
  ['MBJJB8EM301714068~0726','KY01A'],['MBJJB8EMX01713967~0726','KL01A'],['MBJJB8EM401714144~0726','KY01A'],
  ['MBJAABAA801435582~0726','KL01A'],['MBJAABAA901435350~0726','KY01A'],['MBJABBAA801574902~0726','KY01A'],
  ['MBJABBAA801575046~0726','KY01A'],['MBJAABAA901435610~0726','KY01A'],['MBJABBAA101574823~0726','KL01A'],
  ['MBJABBAA901575122~0726','KY01A'],['MBJAABAA701435654~0726','KL01A'],['MBJAB3EMX04585814~0726','KY01A'],
  ['MBJAA3GS400667706~0726','KL01A'],['MBJAA3GS500668346~0726','KY01A'],['MBJABBAA601575014~0726','KY01A'],
  ['MBJAABAA501435622~0726','KY01A'],['MBJAB3EMX04585795~0726','KY01A'],['MBJAA3GS400668189~0726','KY01A'],
  ['MBJAA3GS300668233~0726','KY01A'],['MBJBE3FS101486650~0726','KY01A'],['MBJUYML1STE221922','KY01A'],
  ['MBJUYMM1STD215504','KL01A'],['MBJUYML1STG232020','KY01A'],['MBHJWC13STGD30855','KY01A'],
  ['MBHJWC13STGD31880','KL01A'],['MBHLWF13STG918476','KL01A'],['MBHLWF13STG920241','KY01A'],
  ['MBHJWC13STGD36480','KY01A'],['MBHLWF13STG924646','KL01A'],['MBHJWC13STGD33505','KY01A'],
  ['MBJUYML1STG230504','KL01A'],['MBHLWF13STG917714','KY01A'],['MBHLWF13STG924601','KY01A'],
  ['MBHLWF13STG927934','KL01A'],['MBJUYML1STG230276','KL01A'],['MBHLWF13STG924132','KL01A'],
  ['MBHJWC13STGD31547','KY01A'],['MBJUYML1STF228710','KY01A'],['MBJUYML1STF228447','KL01A'],
  ['MBHLWF13STG917458','KL01A'],['MBHLWF13STG922545','KL01A'],['MBHLWF13STG919269','KY01A'],
  ['MBHLWF13STG926147','KL01A'],['MBHLWF13STG919339','KY01A'],['MBHLWF43STF903825','KL01A'],
  ['MBHLWF13STG927653','KY01A'],['MBJUYML1STF227562','KL01A'],['MBJUYML1STF229723','KL01A'],
  ['MBJUYML1STG230157','KL01A'],['MA3DND72STFD22000','KL01A'],['MBHLWF13STG926217','KY01A'],
  ['MBHLWF13STG920698','KY01A'],
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
    await runBatch(UPDATES.slice(i, i + BATCH), batchNum++);
    if (i + BATCH < UPDATES.length) await new Promise(r => setTimeout(r, 800));
  }
  console.log('\nAll done.');
}
main().catch((e) => { console.error(e); process.exit(1); });
