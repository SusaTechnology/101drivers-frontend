-- CMS: admin-editable blog / news / careers content + media library
--
-- Moves public marketing content from compile-time TS registries
-- (repo src/content/**) into Postgres, edited from the new admin-cms
-- panel. Shapes mirror the FE registry types 1:1 (see src/content/types.ts):
--   CmsBlogPost.body   = BlogBlock[]  (typed blocks, never raw HTML)
--   CmsNewsPost.body   = string[]     (paragraphs)
--   CmsJobPosting.body = string[]     (paragraphs)
-- `date` stays TEXT (yyyy-mm-dd) to match the public contract — ISO dates
-- sort correctly as text. The existing static content is imported once on
-- boot by cms.service.ts seedIfEmpty (guarded by a CMS_SEED_STATIC_V1 app
-- setting); nothing is lost, and the static registries remain in the bundle
-- as an API-outage fallback.
--
-- Enum: DRAFT / PUBLISHED. Drafts are visible only through the admin
-- endpoints; public GETs filter to PUBLISHED.

-- CreateEnum
CREATE TYPE "EnumCmsContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "CmsBlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "kicker" TEXT,
    "readingMinutes" INTEGER,
    "author" TEXT,
    "image" TEXT,
    "imageAlt" TEXT,
    "body" JSONB NOT NULL,
    "status" "EnumCmsContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsBlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsNewsPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "image" TEXT,
    "imageAlt" TEXT,
    "body" JSONB NOT NULL,
    "status" "EnumCmsContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsNewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsJobPosting" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "applyEmail" TEXT NOT NULL,
    "status" "EnumCmsContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsJobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsMediaAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CmsBlogPost_slug_key" ON "CmsBlogPost"("slug");
CREATE INDEX "CmsBlogPost_status_date_idx" ON "CmsBlogPost"("status", "date");

CREATE UNIQUE INDEX "CmsNewsPost_slug_key" ON "CmsNewsPost"("slug");
CREATE INDEX "CmsNewsPost_status_date_idx" ON "CmsNewsPost"("status", "date");

CREATE UNIQUE INDEX "CmsJobPosting_slug_key" ON "CmsJobPosting"("slug");
CREATE INDEX "CmsJobPosting_status_title_idx" ON "CmsJobPosting"("status", "title");

CREATE UNIQUE INDEX "CmsMediaAsset_filename_key" ON "CmsMediaAsset"("filename");
CREATE INDEX "CmsMediaAsset_createdAt_idx" ON "CmsMediaAsset"("createdAt");
