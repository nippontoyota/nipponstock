-- Adds a separate column for the automated stockyard sync, so it stops
-- overwriting the existing admin-curated "stockyardLocation" field.
ALTER TABLE "Vehicle" ADD COLUMN "stockyardLiveLocation" TEXT NOT NULL DEFAULT '';
