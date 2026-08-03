import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

function hardBlockExpiryFrom(baseDate: Date, days: number): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const baseIst = new Date(baseDate.getTime() + IST_OFFSET_MS);
  const expiryMidnightIst = Date.UTC(
    baseIst.getUTCFullYear(),
    baseIst.getUTCMonth(),
    baseIst.getUTCDate() + days,
  );
  return new Date(expiryMidnightIst - IST_OFFSET_MS + 23 * 60 * 60 * 1000);
}

async function main() {
  const physicalBranch = await prisma.branch.findFirstOrThrow({ where: { branchCode: 'CO01B' } });
  const allottedBranch = await prisma.branch.findFirstOrThrow({ where: { branchCode: 'TR01A' } });
  const tlUser = await prisma.user.findUniqueOrThrow({ where: { loginId: 'subeer.tr01a' } });

  const assignmentDate = new Date('2026-07-08T00:00:00.000Z');
  const expiryAt = hardBlockExpiryFrom(assignmentDate, 30);

  const vehicle = await prisma.vehicle.upsert({
    where: { chassisNumber: '202606118254' },
    update: {
      model: 'D27',
      suffix: 'D27QA',
      colour: 'E5G',
      chassisYear: 2026,
      stockStatus: 'MDDP',
      stockyardLocation: 'CO01B',
      physicalStockBranchId: physicalBranch.id,
      assignmentDate,
      status: 'HARD_BLOCKED',
    },
    create: {
      chassisNumber: '202606118254',
      model: 'D27',
      suffix: 'D27QA',
      colour: 'E5G',
      chassisYear: 2026,
      stockStatus: 'MDDP',
      stockyardLocation: 'CO01B',
      physicalStockBranchId: physicalBranch.id,
      assignmentDate,
      status: 'HARD_BLOCKED',
    },
  });

  console.log(`✅ Vehicle: ${vehicle.chassisNumber} (${vehicle.model} ${vehicle.suffix} ${vehicle.colour})`);

  const existingBlock = await prisma.blockingRequest.findFirst({
    where: { vehicleId: vehicle.id, status: 'ACTIVE' },
  });

  if (existingBlock) {
    console.log(`ℹ️  Active blocking already exists: ${existingBlock.id} — skipping`);
  } else {
    const blocking = await prisma.blockingRequest.create({
      data: {
        vehicleId: vehicle.id,
        userId:    tlUser.id,
        branchId:  allottedBranch.id,
        blockType: 'HARD',
        status:    'ACTIVE',
        softBlockAt: assignmentDate,
        hardBlockAt: assignmentDate,
        expiryAt,
        orderId:        '8766432',
        customerName:   'KING INTERNATIONAL GENERAL TRADING COMPANY',
        teamLeaderName: 'SUBEER K',
        consultantName: 'PRASOON PRAKASH',
      },
    });
    console.log(`✅ Blocking created: ${blocking.id}`);
    console.log(`   Branch: ${allottedBranch.name} (${allottedBranch.branchCode})`);
    console.log(`   Expiry: ${expiryAt.toISOString()}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
