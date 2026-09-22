-- Add per-stage document upload fields to DeliveryWorkflow
ALTER TABLE "DeliveryWorkflow" ADD COLUMN "doUrl" TEXT;
ALTER TABLE "DeliveryWorkflow" ADD COLUMN "disclaimerUrl" TEXT;
ALTER TABLE "DeliveryWorkflow" ADD COLUMN "fastagUrl" TEXT;
ALTER TABLE "DeliveryWorkflow" ADD COLUMN "roadTaxUrl" TEXT;
