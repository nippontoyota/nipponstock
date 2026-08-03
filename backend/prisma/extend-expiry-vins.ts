import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

const VINS = [
  'MBJUYMM1STB207607',
  'MBJABBAA301567811~0526',
  'MBJAB3EM804582975~0526',
  'MA3DND62SSMB88731',
  'MBJAC3AK202003542~0526',
  'MBJAABAA901431573~0526',
  'MBHJWC13STEC91610',
  'MBJUYMM1STD214101',
  'MA3DND62SSMB88698',
  'MA3DND72STCC56479',
  'MBJABBAA801565293~0426',
  'MBJAB3EM004581349~0426',
  'MBJBA3CD606364192~0126',
  'MBJUYML1SSG171797',
  'MBJUYML1STA199770',
  'MBHJWC13SSLB51761',
  'MBJUYMM1STB206257',
  'MBJUYML1STD216688',
  'MBJABBAA301567694~0526',
  'MBJUYML1SSL193117',
  'MBJUYML1STC214490',
  'MBJAABAA801429605~0426',
  'MBHLWF13STE871837',
  'MBJABBAA601567186~0526',
  'MBHLWF43STE866332',
  'MBJBA3CDX06364972~0426',
  'MBJUYML1STD218109',
  'MBJUYMM1STC212379',
  'MBJABBAA701563261~0426',
  'MBHLWF13SSM733331',
  'MBJUYML1STC210574',
  'MBHJWC13SSMB71727',
  'MBJBE3FS401485850~0526',
  'MBJJB8EM001710351~0526',
  'MBJABBAA001568107~0526',
  'MBJABBAA601562781~0426',
  'MBHLWF13STE874112',
  'MBHLWF13STE873698',
  'MBJABBAA201568724~0526',
  'MBJABBAA001568446~0526',
  'MBJAABAA501432218~0526',
  'MBJAABAA801432259~0526',
  'MBJAABAA001432157~0526',
  'MBJABBAA101568777~0526',
  'MBJABBAA301568568~0526',
  'MBJAB3EM404583167~0526',
  'MBJAABAA601432244~0526',
  'MBJABBAA801568629~0526',
  'MBHLWF13STE874428',
  'MBHJWC13STEC92895',
  'MBJABBAA701568640~0526',
  'MBJABBAA101568682~0526',
  'MBHJWC13STEC97407',
  'MBJUYML1STE223019',
  'MBJUYML1STD220652',
  'MBHLWF13STD856031',
  'MBJUYML1STD220922',
  'MBJABBAA801536523~1125',
  'MBHJWC13STEC94647',
  'MBJJB8EM001710382~0526',
  'MBJAABAA301432184~0526',
  'MBJUYMM1STC211666',
  'MBJAABAA201432337~0526',
  'MBJABBAA501568801~0526',
  'MBJUYML1STA202886',
  'MBJUYMM1STB206673',
  'MBJUYML1STA197812',
  'MBJAABAA101431289~0526',
];

const NEW_EXPIRY = new Date('2026-06-09T12:12:12.000Z');

async function main() {
  // Find active blockings whose vehicle chassisNumber is in the list
  const blockings = await prisma.blockingRequest.findMany({
    where: {
      status: 'ACTIVE',
      vehicle: { chassisNumber: { in: VINS } },
    },
    select: {
      id: true,
      expiryAt: true,
      vehicle: { select: { chassisNumber: true } },
    },
  });

  console.log(`Found ${blockings.length} active blockings (out of ${VINS.length} VINs)`);

  const notFound = VINS.filter((v) => !blockings.some((b) => b.vehicle.chassisNumber === v));
  if (notFound.length) {
    console.log(`\nNot matched (${notFound.length}):`);
    notFound.forEach((v) => console.log(`  ${v}`));
  }

  if (!blockings.length) { console.log('Nothing to update.'); return; }

  const ids = blockings.map((b) => b.id);
  const result = await prisma.blockingRequest.updateMany({
    where: { id: { in: ids } },
    data: { expiryAt: NEW_EXPIRY },
  });

  console.log(`\nUpdated ${result.count} blockings → expiryAt = ${NEW_EXPIRY.toISOString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
