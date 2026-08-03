import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const s = await prisma.vehicle.findMany({ take: 10, select: { id: true, chassisNumber: true }, orderBy: { createdAt: 'desc' } });
  console.log('Sample vehicle IDs and chassis numbers:');
  s.forEach(v => console.log(`  id="${v.id}"  chassis="${v.chassisNumber}"`));
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
