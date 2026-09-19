-- CreateTable
CREATE TABLE "BranchMtdTally" (
    "id" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 0,
    "mtdTally" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchMtdTally_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchMtdTally_branchCode_key" ON "BranchMtdTally"("branchCode");
