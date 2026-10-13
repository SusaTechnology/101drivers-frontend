-- Driver service area: ONE polygon (LA metro) stored IN THE DATABASE so
-- ops can edit it (admin map editor) without a deploy. Derived per-driver
-- eligibility from residentialZip via point-in-polygon; audit enum gains
-- the two new actions. Manual driver status is NEVER touched by this.

-- ── The polygon (single-row by convention) ──
CREATE TABLE "ServiceAreaPolygon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coordsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAreaPolygon_pkey" PRIMARY KEY ("id")
);

-- ── ZIP → centroid cache (one Google geocode call per distinct ZIP, ever) ──
CREATE TABLE "ServiceAreaZipCache" (
    "zip" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAreaZipCache_pkey" PRIMARY KEY ("zip")
);

-- ── Per-driver derived eligibility (NEVER drives `status`) ──
ALTER TABLE "Driver" ADD COLUMN "serviceAreaInArea" BOOLEAN;
ALTER TABLE "Driver" ADD COLUMN "serviceAreaZip" TEXT;
ALTER TABLE "Driver" ADD COLUMN "serviceAreaCheckedAt" TIMESTAMP(3);
ALTER TABLE "Driver" ADD COLUMN "serviceAreaFlagged" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "EnumAdminAuditLogAction" ADD VALUE IF NOT EXISTS 'SERVICE_AREA_UPDATE';
ALTER TYPE "EnumAdminAuditLogAction" ADD VALUE IF NOT EXISTS 'DRIVER_SERVICE_AREA_CHANGE';

-- ── Day-one seed: LA metro zone ──
-- Santa Barbara down the coast through Long Beach to San Diego; inland
-- edge runs past Palm Springs and Joshua Tree. Ops can reshape every
-- vertex from the admin map editor — this INSERT only guarantees the
-- polygon exists the moment the migration lands.
INSERT INTO "ServiceAreaPolygon" ("id", "name", "coordsJson", "updatedAt")
VALUES (
  'service-area-la-metro-v1',
  'LA Metro',
  '[[34.55,-120.62],[34.42,-120.15],[34.25,-119.55],[34.05,-119.1],[33.9,-118.62],[33.8,-118.35],[33.73,-118.05],[33.42,-117.68],[33.05,-117.32],[32.68,-117.35],[32.53,-116.68],[32.62,-115.95],[33.2,-115.35],[33.95,-115.25],[34.35,-115.15],[34.75,-116.4],[34.8,-117.55],[34.7,-118.9],[34.55,-119.8]]'::jsonb,
  CURRENT_TIMESTAMP
);
