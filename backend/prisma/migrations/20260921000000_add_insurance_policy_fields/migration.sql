-- Add insurance policy number and policy document upload fields to DeliveryWorkflow
ALTER TABLE "DeliveryWorkflow" ADD COLUMN "insurancePolicyNumber" TEXT;
ALTER TABLE "DeliveryWorkflow" ADD COLUMN "policyUrl" TEXT;
