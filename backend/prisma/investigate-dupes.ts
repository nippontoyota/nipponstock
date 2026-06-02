import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const CHASSIS = ['MBJABBAA701568718~0526', 'MBJABBAA901567912~0526'];

async function main() {
  // 1. How many Vehicle rows exist per chassis number?
  const dupes = await prisma.$queryRaw<{ chassisNumber: string; cnt: bigint; ids: string[]; statuses: string[] }[]>`
    SELECT "chassisNumber", COUNT(*) as cnt, array_agg(id) as ids, array_agg(status) as statuses
    FROM "Vehicle"
    WHERE "chassisNumber" = ANY(${CHASSIS})
    GROUP BY "chassisNumber"
  `;
  console.log('\n── Vehicle rows per chassis ──');
  for (const d of dupes) {
    console.log(`  ${d.chassisNumber}: ${d.cnt} row(s)  ids=${d.ids}  statuses=${d.statuses}`);
  }

  // 2. All blockings for these chassis numbers
  const blockings = await prisma.blockingRequest.findMany({
    where: { vehicle: { chassisNumber: { in: CHASSIS } } },
    select: {
      id: true, status: true, blockType: true,
      vehicle: { select: { id: true, chassisNumber: true, status: true } },
      branch: { select: { branchCode: true } },
      user: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n── Blockings ──');
  for (const b of blockings) {
    console.log(`  blocking=${b.id}  status=${b.status}  blockType=${b.blockType}`);
    console.log(`    vehicle=${b.vehicle.id}  chassis=${b.vehicle.chassisNumber}  vehicleStatus=${b.vehicle.status}`);
    console.log(`    branch=${b.branch.branchCode}  user=${b.user.fullName}`);
  }

  // 3. Check overall: how many chassis numbers have >1 Vehicle record?
  const allDupes = await prisma.$queryRaw<{ chassisNumber: string; cnt: bigint }[]>`
    SELECT "chassisNumber", COUNT(*) as cnt
    FROM "Vehicle"
    GROUP BY "chassisNumber"
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `;
  console.log(`\n── All chassis numbers with duplicate Vehicle rows (top 20) ──`);
  if (allDupes.length === 0) console.log('  None found.');
  for (const d of allDupes) console.log(`  ${d.chassisNumber}: ${d.cnt} rows`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
