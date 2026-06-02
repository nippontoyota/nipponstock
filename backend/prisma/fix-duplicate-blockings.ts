import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

async function main() {
  // Vehicle 9874947 (MBJABBAA901567912~0526):
  // ACTIVE by KT01A (60b9c260) and ACTIVE by PH01A (34b74476)
  // Expire the PH01A one — it was the second (race-condition) block
  const r1 = await prisma.blockingRequest.update({
    where: { id: '34b74476-1268-4b2b-b9ac-7defed20f2af' },
    data: { status: 'EXPIRED' },
    select: { id: true, status: true, branch: { select: { branchCode: true } } },
  });
  console.log(`Expired: ${r1.id} (${r1.branch.branchCode}) → ${r1.status}`);

  // Vehicle 9874819 (MBJABBAA701568718~0526):
  // Has a DELIVERED blocking (783465378, TR01A) and an ACTIVE blocking (6fec8ffe, TR01A) — same person
  // The vehicle is currently HARD_BLOCKED but was previously delivered.
  // Expire the extra ACTIVE blocking so only the DELIVERED history remains.
  const r2 = await prisma.blockingRequest.update({
    where: { id: '6fec8ffe-7ec0-4fbe-bed8-90e15986bc48' },
    data: { status: 'EXPIRED' },
    select: { id: true, status: true, branch: { select: { branchCode: true } } },
  });
  console.log(`Expired: ${r2.id} (${r2.branch.branchCode}) → ${r2.status}`);

  // Also reset vehicle 9874819 status to OPEN since the DELIVERED blocking means it was already billed
  // Actually — if delivered, vehicle should stay DELIVERED status, not HARD_BLOCKED
  const v = await prisma.vehicle.update({
    where: { id: '9874819' },
    data: { status: 'DELIVERED' },
    select: { id: true, chassisNumber: true, status: true },
  });
  console.log(`Vehicle ${v.chassisNumber} → ${v.status}`);

  console.log('\nDone. Re-run investigate-dupes.ts to verify.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
