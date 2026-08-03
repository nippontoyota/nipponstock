import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL!;
const prisma = new PrismaClient();

// Expiry = 11:00 PM IST on day N after a given base date
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
  // ── Branch lookups ────────────────────────────────────────────────────────
  const physicalBranch = await prisma.branch.findFirstOrThrow({ where: { branchCode: 'CO01B' } });
  const allottedBranch = await prisma.branch.findFirstOrThrow({ where: { branchCode: 'TR01A' } });

  // ── User: SUBEER K (subeer.tr01a) — TL who owns the blocking ─────────────
  const tlUser = await prisma.user.findUniqueOrThrow({ where: { loginId: 'subeer.tr01a' } });

  // ── Assignment date ───────────────────────────────────────────────────────
  const assignmentDate = new Date('2026-07-17T00:00:00.000Z');
  const blockAt       = assignmentDate; // treat assignment date as block date

  // Blocking days for MDDP — use 30 days
  const BLOCKING_DAYS = 30;
  const expiryAt = hardBlockExpiryFrom(assignmentDate, BLOCKING_DAYS);

  // ── Upsert vehicle ────────────────────────────────────────────────────────
  const vehicle = await prisma.vehicle.upsert({
    where: { chassisNumber: '202606118263' },
    update: {
      model: 'D27',
      suffix: 'D27QA',
      colour: 'ZHJ',
      chassisYear: 2026,
      stockStatus: 'MDDP',
      stockyardLocation: 'CO01B',
      physicalStockBranchId: physicalBranch.id,
      assignmentDate,
      status: 'HARD_BLOCKED',
    },
    create: {
      chassisNumber: '202606118263',
      model: 'D27',
      suffix: 'D27QA',
      colour: 'ZHJ',
      chassisYear: 2026,
      stockStatus: 'MDDP',
      stockyardLocation: 'CO01B',
      physicalStockBranchId: physicalBranch.id,
      assignmentDate,
      status: 'HARD_BLOCKED',
    },
  });

  console.log(`✅ Vehicle: ${vehicle.chassisNumber} (${vehicle.model} ${vehicle.suffix} ${vehicle.colour})`);

  // ── Check if a blocking already exists for this vehicle ──────────────────
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
        softBlockAt: blockAt,
        hardBlockAt: blockAt,
        expiryAt,
        orderId:       '8766366',
        customerName:  'KING INTERNATIONAL GENERAL TRADING COMPANY',
        teamLeaderName: 'SUBEER K',
        consultantName: 'PRASOON PRAKASH',
      },
    });
    console.log(`✅ Blocking created: ${blocking.id}`);
    console.log(`   Branch: ${allottedBranch.name} (${allottedBranch.branchCode})`);
    console.log(`   User:   ${tlUser.fullName} (${tlUser.loginId})`);
    console.log(`   Expiry: ${expiryAt.toISOString()}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
