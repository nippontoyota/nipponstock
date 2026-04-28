-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES_MANAGER');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('OPEN', 'SOFT_BLOCKED', 'HARD_BLOCKED', 'EXPIRED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('SOFT', 'HARD');

-- CreateEnum
CREATE TYPE "BlockingStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'FINANCE');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "chassisNumber" TEXT NOT NULL,
    "chassisYear" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "stockyardLocation" TEXT NOT NULL,
    "dateOfArrival" TIMESTAMP(3) NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockingRequest" (
    "id" TEXT NOT NULL,
    "blockType" "BlockType" NOT NULL DEFAULT 'SOFT',
    "orderId" TEXT,
    "customerName" TEXT,
    "consultantName" TEXT,
    "paymentMode" "PaymentMode",
    "financierBank" TEXT,
    "paymentStatus" TEXT,
    "expectedBillingDate" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "softBlockAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hardBlockAt" TIMESTAMP(3),
    "expiryAt" TIMESTAMP(3),
    "status" "BlockingStatus" NOT NULL DEFAULT 'ACTIVE',
    "retailId" TEXT,
    "deliveryDocUrl" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "extendedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "BlockingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelConfig" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "blockingDurationDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "GlobalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_chassisNumber_key" ON "Vehicle"("chassisNumber");

-- CreateIndex
CREATE INDEX "Vehicle_model_suffix_colour_idx" ON "Vehicle"("model", "suffix", "colour");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE INDEX "BlockingRequest_vehicleId_idx" ON "BlockingRequest"("vehicleId");

-- CreateIndex
CREATE INDEX "BlockingRequest_userId_idx" ON "BlockingRequest"("userId");

-- CreateIndex
CREATE INDEX "BlockingRequest_branchId_idx" ON "BlockingRequest"("branchId");

-- CreateIndex
CREATE INDEX "BlockingRequest_status_idx" ON "BlockingRequest"("status");

-- CreateIndex
CREATE INDEX "BlockingRequest_expiryAt_idx" ON "BlockingRequest"("expiryAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelConfig_modelName_key" ON "ModelConfig"("modelName");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalConfig_key_key" ON "GlobalConfig"("key");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_performedAt_idx" ON "AuditLog"("performedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockingRequest" ADD CONSTRAINT "BlockingRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockingRequest" ADD CONSTRAINT "BlockingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockingRequest" ADD CONSTRAINT "BlockingRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelConfig" ADD CONSTRAINT "ModelConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalConfig" ADD CONSTRAINT "GlobalConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
