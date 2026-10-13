-- Bay Area polygon removal (owner requirement: "Delete the Bay Area
-- polygon from the database and remove any code referencing it").
--
-- The service area is the LA metro zone ONLY (the ServiceAreaPolygon row
-- seeded by 20261013150000_service_area_polygon). Any Bay-Area polygon
-- that existed in the ServiceDistrict table (created via the districts
-- admin UI) is obsolete and is deleted here.
--
-- The match is PRECISE — code 'BAY_AREA' / code like BAY%AREA% / name
-- containing "bay area" — so the LA "South Bay" district (code SOUTHBAY,
-- a real Los Angeles district) can never match. Driver district
-- preferences pointing at the deleted rows go first (FK restrict).
--
-- Code references are already gone in the same change-set: the signup
-- form's "Bay Area" district option and any Bay-Area polygon constants.

DELETE FROM "DriverDistrictPreference"
WHERE "districtId" IN (
  SELECT "id" FROM "ServiceDistrict"
  WHERE "code" = 'BAY_AREA'
     OR "code" ILIKE 'BAY%AREA%'
     OR "name" ILIKE '%bay area%'
);

DELETE FROM "ServiceDistrict"
WHERE "code" = 'BAY_AREA'
   OR "code" ILIKE 'BAY%AREA%'
   OR "name" ILIKE '%bay area%';
