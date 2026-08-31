-- CreateTable
CREATE TABLE "VisibilitySnapshot" (
    "id" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalVisibility" INTEGER NOT NULL,

    CONSTRAINT "VisibilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisibilitySnapshot_capturedAt_idx" ON "VisibilitySnapshot"("capturedAt");
