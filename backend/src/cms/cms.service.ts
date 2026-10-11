import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import * as common from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EnumCmsContentStatus,
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import {
  BlogInput,
  JobInput,
  NewsInput,
} from "./cms.validators";
import * as seedData from "./seed-data.json";

// The JSON import infers a union of literal object shapes (some posts have
// kicker/author/image, others don't) — normalize to the seed contract so the
// compiler treats missing optional fields as undefined instead of erroring.
interface SeedBlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  kicker?: string;
  readingMinutes?: number;
  author?: string;
  image?: string;
  imageAlt?: string;
  body: unknown;
}
interface SeedNewsPost {
  slug: string;
  title: string;
  date: string;
  tag: string;
  excerpt: string;
  image?: string;
  imageAlt?: string;
  body: unknown;
}
interface SeedJobPosting {
  slug: string;
  title: string;
  location: string;
  type: string;
  employmentType: string;
  excerpt: string;
  body: unknown;
  applyEmail: string;
}
const SEED_BLOG = seedData.blog as unknown as SeedBlogPost[];
const SEED_NEWS = seedData.news as unknown as SeedNewsPost[];
const SEED_CAREERS = seedData.careers as unknown as SeedJobPosting[];

/**
 * CMS service — blog / news / careers content + media library.
 *
 * Content model: the DB is the single source of truth for the public pages;
 * the static registries (repo src/content/**) remain in the FE bundle ONLY
 * as an API-outage fallback. On the first boot after this migration the
 * static content is imported once (seedIfEmpty, guarded by a
 * CMS_SEED_STATIC_V1 app setting) so the site keeps showing exactly what it
 * shows today — then the admin panel owns it.
 */

type CmsSection = "blog" | "news" | "careers";

const SEED_FLAG = "CMS_SEED_STATIC_V1";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const MEDIA_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MEDIA_FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,118}$/;

@common.Injectable()
export class CmsService implements common.OnModuleInit {
  private readonly logger = new common.Logger("CmsService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ── One-time import of the static registries ─────────────────────────────
  // Runs after every boot; exits immediately once the flag row exists. Any
  // failure is logged and retried on the NEXT boot (the flag is only written
  // after everything succeeded). Unique slug constraints make the per-item
  // path idempotent even if a previous boot died mid-seed.
  async onModuleInit(): Promise<void> {
    await this.seedIfEmpty();
  }

  private async seedIfEmpty(): Promise<void> {
    try {
      const flag = await this.prisma.appSetting.findUnique({
        where: { key: SEED_FLAG },
      });
      if (flag) return;

      const counts = { blog: 0, news: 0, careers: 0 };

      for (const post of SEED_BLOG) {
        const exists = await this.prisma.cmsBlogPost.findUnique({
          where: { slug: post.slug },
          select: { id: true },
        });
        if (exists) continue;
        await this.prisma.cmsBlogPost.create({
          data: {
            slug: post.slug,
            title: post.title,
            date: post.date,
            excerpt: post.excerpt,
            kicker: post.kicker ?? null,
            readingMinutes: post.readingMinutes ?? null,
            author: post.author ?? null,
            image: post.image ?? null,
            imageAlt: post.imageAlt ?? null,
            body: post.body as unknown as Prisma.InputJsonValue,
            status: EnumCmsContentStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        });
        counts.blog += 1;
      }

      for (const post of SEED_NEWS) {
        const exists = await this.prisma.cmsNewsPost.findUnique({
          where: { slug: post.slug },
          select: { id: true },
        });
        if (exists) continue;
        await this.prisma.cmsNewsPost.create({
          data: {
            slug: post.slug,
            title: post.title,
            date: post.date,
            tag: post.tag,
            excerpt: post.excerpt,
            image: post.image ?? null,
            imageAlt: post.imageAlt ?? null,
            body: post.body as unknown as Prisma.InputJsonValue,
            status: EnumCmsContentStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        });
        counts.news += 1;
      }

      for (const role of SEED_CAREERS) {
        const exists = await this.prisma.cmsJobPosting.findUnique({
          where: { slug: role.slug },
          select: { id: true },
        });
        if (exists) continue;
        await this.prisma.cmsJobPosting.create({
          data: {
            slug: role.slug,
            title: role.title,
            location: role.location,
            type: role.type,
            employmentType: role.employmentType,
            excerpt: role.excerpt,
            body: role.body as unknown as Prisma.InputJsonValue,
            applyEmail: role.applyEmail,
            status: EnumCmsContentStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        });
        counts.careers += 1;
      }

      await this.prisma.appSetting.create({
        data: {
          key: SEED_FLAG,
          value: { seededAt: new Date().toISOString(), counts },
        },
      });

      this.logger.log(
        `CMS seed: imported ${counts.blog} blog posts, ${counts.news} news items, ${counts.careers} job postings from the static registries`,
      );
    } catch (err) {
      // Missing tables (migration not applied yet) or a transient DB hiccup
      // must never crash the app — the flag stays unset so the next boot
      // retries.
      this.logger.error(
        `CMS seed skipped (will retry next boot): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Public queries (PUBLISHED only) ──────────────────────────────────────
  async listPublicBlog(): Promise<unknown[]> {
    const rows = await this.prisma.cmsBlogPost.findMany({
      where: { status: EnumCmsContentStatus.PUBLISHED },
      orderBy: [{ date: "desc" }, { slug: "asc" }],
    });
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      date: row.date,
      excerpt: row.excerpt,
      kicker: row.kicker ?? undefined,
      readingMinutes: row.readingMinutes ?? undefined,
      author: row.author ?? undefined,
      image: row.image ?? undefined,
      imageAlt: row.imageAlt ?? undefined,
      body: row.body,
    }));
  }

  async getPublicBlogPost(slug: string): Promise<unknown | null> {
    const row = await this.prisma.cmsBlogPost.findFirst({
      where: { slug, status: EnumCmsContentStatus.PUBLISHED },
    });
    return row
      ? {
          slug: row.slug,
          title: row.title,
          date: row.date,
          excerpt: row.excerpt,
          kicker: row.kicker ?? undefined,
          readingMinutes: row.readingMinutes ?? undefined,
          author: row.author ?? undefined,
          image: row.image ?? undefined,
          imageAlt: row.imageAlt ?? undefined,
          body: row.body,
        }
      : null;
  }

  async listPublicNews(): Promise<unknown[]> {
    const rows = await this.prisma.cmsNewsPost.findMany({
      where: { status: EnumCmsContentStatus.PUBLISHED },
      orderBy: [{ date: "desc" }, { slug: "asc" }],
    });
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      date: row.date,
      tag: row.tag,
      excerpt: row.excerpt,
      image: row.image ?? undefined,
      imageAlt: row.imageAlt ?? undefined,
      body: row.body,
    }));
  }

  async getPublicNewsPost(slug: string): Promise<unknown | null> {
    const row = await this.prisma.cmsNewsPost.findFirst({
      where: { slug, status: EnumCmsContentStatus.PUBLISHED },
    });
    return row
      ? {
          slug: row.slug,
          title: row.title,
          date: row.date,
          tag: row.tag,
          excerpt: row.excerpt,
          image: row.image ?? undefined,
          imageAlt: row.imageAlt ?? undefined,
          body: row.body,
        }
      : null;
  }

  async listPublicCareers(): Promise<unknown[]> {
    const rows = await this.prisma.cmsJobPosting.findMany({
      where: { status: EnumCmsContentStatus.PUBLISHED },
      // Jobs have no date — the owner curates the order; updatedAt mirrors
      // "most recently touched first" which is the sanest default.
      orderBy: [{ updatedAt: "desc" }],
    });
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      location: row.location,
      type: row.type,
      employmentType: row.employmentType,
      excerpt: row.excerpt,
      body: row.body,
      applyEmail: row.applyEmail,
    }));
  }

  async getPublicJobPosting(slug: string): Promise<unknown | null> {
    const row = await this.prisma.cmsJobPosting.findFirst({
      where: { slug, status: EnumCmsContentStatus.PUBLISHED },
    });
    return row
      ? {
          slug: row.slug,
          title: row.title,
          location: row.location,
          type: row.type,
          employmentType: row.employmentType,
          excerpt: row.excerpt,
          body: row.body,
          applyEmail: row.applyEmail,
        }
      : null;
  }

  // ── Admin CRUD ───────────────────────────────────────────────────────────
  async listAdminBlog(): Promise<unknown[]> {
    return this.prisma.cmsBlogPost.findMany({
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  async createBlog(input: BlogInput, userId?: string): Promise<unknown> {
    await this.assertSlugFree("blog", input.slug);
    const row = await this.prisma.cmsBlogPost.create({
      data: {
        ...this.blogData(input),
        status: input.status,
        publishedAt:
          input.status === EnumCmsContentStatus.PUBLISHED ? new Date() : null,
        createdByUserId: userId ?? null,
      },
    });
    await this.audit("created", "blog", row, userId);
    return row;
  }

  async updateBlog(id: string, patch: Partial<BlogInput>, userId?: string): Promise<unknown> {
    const existing = await this.prisma.cmsBlogPost.findUnique({ where: { id } });
    if (!existing) throw new common.NotFoundException("Blog post not found.");

    const merged: BlogInput = {
      slug: patch.slug ?? existing.slug,
      title: patch.title ?? existing.title,
      date: patch.date ?? existing.date,
      excerpt: patch.excerpt ?? existing.excerpt,
      kicker: patch.kicker !== undefined ? patch.kicker : (existing.kicker ?? undefined),
      readingMinutes:
        patch.readingMinutes !== undefined ? patch.readingMinutes : (existing.readingMinutes ?? undefined),
      author: patch.author !== undefined ? patch.author : (existing.author ?? undefined),
      image: patch.image !== undefined ? patch.image : (existing.image ?? undefined),
      imageAlt: patch.imageAlt !== undefined ? patch.imageAlt : (existing.imageAlt ?? undefined),
      body: (patch.body ?? (existing.body as unknown as BlogInput["body"])),
      status: patch.status ?? existing.status,
    };

    if (merged.slug !== existing.slug) {
      await this.assertSlugFree("blog", merged.slug, id);
    }

    const row = await this.prisma.cmsBlogPost.update({
      where: { id },
      data: {
        slug: merged.slug,
        title: merged.title,
        date: merged.date,
        excerpt: merged.excerpt,
        kicker: merged.kicker ?? null,
        readingMinutes: merged.readingMinutes ?? null,
        author: merged.author ?? null,
        image: merged.image ?? null,
        imageAlt: merged.imageAlt ?? null,
        body: merged.body as unknown as Prisma.InputJsonValue,
        status: merged.status,
        publishedAt: this.nextPublishedAt(existing.status, merged.status, existing.publishedAt),
      },
    });
    await this.audit("updated", "blog", row, userId, {
      slug: existing.slug,
      title: existing.title,
      status: existing.status,
    });
    return row;
  }

  async listAdminNews(): Promise<unknown[]> {
    return this.prisma.cmsNewsPost.findMany({ orderBy: [{ updatedAt: "desc" }] });
  }

  async createNews(input: NewsInput, userId?: string): Promise<unknown> {
    await this.assertSlugFree("news", input.slug);
    const row = await this.prisma.cmsNewsPost.create({
      data: {
        ...this.newsData(input),
        status: input.status,
        publishedAt:
          input.status === EnumCmsContentStatus.PUBLISHED ? new Date() : null,
        createdByUserId: userId ?? null,
      },
    });
    await this.audit("created", "news", row, userId);
    return row;
  }

  async updateNews(id: string, patch: Partial<NewsInput>, userId?: string): Promise<unknown> {
    const existing = await this.prisma.cmsNewsPost.findUnique({ where: { id } });
    if (!existing) throw new common.NotFoundException("News item not found.");

    const merged: NewsInput = {
      slug: patch.slug ?? existing.slug,
      title: patch.title ?? existing.title,
      date: patch.date ?? existing.date,
      tag: patch.tag ?? existing.tag,
      excerpt: patch.excerpt ?? existing.excerpt,
      image: patch.image !== undefined ? patch.image : (existing.image ?? undefined),
      imageAlt: patch.imageAlt !== undefined ? patch.imageAlt : (existing.imageAlt ?? undefined),
      body: (patch.body ?? (existing.body as unknown as NewsInput["body"])),
      status: patch.status ?? existing.status,
    };

    if (merged.slug !== existing.slug) {
      await this.assertSlugFree("news", merged.slug, id);
    }

    const row = await this.prisma.cmsNewsPost.update({
      where: { id },
      data: {
        slug: merged.slug,
        title: merged.title,
        date: merged.date,
        tag: merged.tag,
        excerpt: merged.excerpt,
        image: merged.image ?? null,
        imageAlt: merged.imageAlt ?? null,
        body: merged.body as unknown as Prisma.InputJsonValue,
        status: merged.status,
        publishedAt: this.nextPublishedAt(existing.status, merged.status, existing.publishedAt),
      },
    });
    await this.audit("updated", "news", row, userId, {
      slug: existing.slug,
      title: existing.title,
      status: existing.status,
    });
    return row;
  }

  async listAdminCareers(): Promise<unknown[]> {
    return this.prisma.cmsJobPosting.findMany({ orderBy: [{ updatedAt: "desc" }] });
  }

  async createCareer(input: JobInput, userId?: string): Promise<unknown> {
    await this.assertSlugFree("careers", input.slug);
    const row = await this.prisma.cmsJobPosting.create({
      data: {
        ...this.jobData(input),
        status: input.status,
        publishedAt:
          input.status === EnumCmsContentStatus.PUBLISHED ? new Date() : null,
        createdByUserId: userId ?? null,
      },
    });
    await this.audit("created", "careers", row, userId);
    return row;
  }

  async updateCareer(id: string, patch: Partial<JobInput>, userId?: string): Promise<unknown> {
    const existing = await this.prisma.cmsJobPosting.findUnique({ where: { id } });
    if (!existing) throw new common.NotFoundException("Job posting not found.");

    const merged: JobInput = {
      slug: patch.slug ?? existing.slug,
      title: patch.title ?? existing.title,
      location: patch.location ?? existing.location,
      type: patch.type ?? existing.type,
      // The DB column is a plain string; it was validated against the enum at
      // create/update time, so the cast only re-widens the type.
      employmentType: (patch.employmentType ?? existing.employmentType) as JobInput["employmentType"],
      excerpt: patch.excerpt ?? existing.excerpt,
      body: (patch.body ?? (existing.body as unknown as JobInput["body"])),
      applyEmail: patch.applyEmail ?? existing.applyEmail,
      status: patch.status ?? existing.status,
    };

    if (merged.slug !== existing.slug) {
      await this.assertSlugFree("careers", merged.slug, id);
    }

    const row = await this.prisma.cmsJobPosting.update({
      where: { id },
      data: {
        slug: merged.slug,
        title: merged.title,
        location: merged.location,
        type: merged.type,
        employmentType: merged.employmentType,
        excerpt: merged.excerpt,
        body: merged.body as unknown as Prisma.InputJsonValue,
        applyEmail: merged.applyEmail,
        status: merged.status,
        publishedAt: this.nextPublishedAt(existing.status, merged.status, existing.publishedAt),
      },
    });
    await this.audit("updated", "careers", row, userId, {
      slug: existing.slug,
      title: existing.title,
      status: existing.status,
    });
    return row;
  }

  async removeSection(section: CmsSection, id: string, userId?: string): Promise<void> {
    switch (section) {
      case "blog": {
        const row = await this.prisma.cmsBlogPost.findUnique({ where: { id } });
        if (!row) throw new common.NotFoundException("Blog post not found.");
        await this.prisma.cmsBlogPost.delete({ where: { id } });
        await this.audit("deleted", "blog", row, userId, {
          slug: row.slug,
          title: row.title,
          status: row.status,
        });
        return;
      }
      case "news": {
        const row = await this.prisma.cmsNewsPost.findUnique({ where: { id } });
        if (!row) throw new common.NotFoundException("News item not found.");
        await this.prisma.cmsNewsPost.delete({ where: { id } });
        await this.audit("deleted", "news", row, userId, {
          slug: row.slug,
          title: row.title,
          status: row.status,
        });
        return;
      }
      case "careers": {
        const row = await this.prisma.cmsJobPosting.findUnique({ where: { id } });
        if (!row) throw new common.NotFoundException("Job posting not found.");
        await this.prisma.cmsJobPosting.delete({ where: { id } });
        await this.audit("deleted", "careers", row, userId, {
          slug: row.slug,
          title: row.title,
          status: row.status,
        });
        return;
      }
    }
  }

  // ── Media library ────────────────────────────────────────────────────────
  private uploadDir(): string {
    return (
      this.configService.get<string>("CMS_UPLOAD_DIR") ??
      path.join(process.cwd(), "uploads")
    );
  }

  async uploadMedia(
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
    userId?: string,
  ): Promise<{ id: string; filename: string; url: string; mimeType: string; sizeBytes: number; originalName: string }> {
    const ext = MEDIA_MIME_EXT[file.mimetype];
    if (!ext) {
      throw new common.BadRequestException(
        "Unsupported image type. Use JPEG, PNG, WebP or GIF.",
      );
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new common.BadRequestException("Image must be between 1 byte and 8 MB.");
    }
    // Never trust the client filename for storage — it is only kept (sanitized)
    // for display in the library.
    const originalName = (file.originalname ?? "image")
      .replace(/[/\\]/g, "")
      .replace(/[\u0000-\u001f]/g, "")
      .slice(0, 120) || "image";

    const filename = `cms-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${ext}`;
    const dir = this.uploadDir();
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, filename), file.buffer);

    const row = await this.prisma.cmsMediaAsset.create({
      data: {
        filename,
        originalName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        createdByUserId: userId ?? null,
      },
    });

    return {
      id: row.id,
      filename,
      url: `/api/cms/media/file/${filename}`,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      originalName: row.originalName,
    };
  }

  async listMedia(): Promise<unknown[]> {
    const rows = await this.prisma.cmsMediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      url: `/api/cms/media/file/${row.filename}`,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
    }));
  }

  async removeMedia(id: string, userId?: string): Promise<void> {
    const row = await this.prisma.cmsMediaAsset.findUnique({ where: { id } });
    if (!row) throw new common.NotFoundException("Image not found.");
    await this.prisma.cmsMediaAsset.delete({ where: { id } });
    try {
      await fs.promises.unlink(path.join(this.uploadDir(), row.filename));
    } catch (err) {
      // Row is already gone; a missing file on disk is acceptable.
      this.logger.warn(
        `CMS media file could not be removed (${row.filename}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await this.audit("deleted", "media", row, userId, {
      slug: row.filename,
      title: row.originalName,
      status: null,
    });
  }

  /** Absolute path of an uploaded file after strict filename validation. */
  resolveMediaPath(filename: string): string | null {
    if (!MEDIA_FILENAME_RE.test(filename) || filename.includes("..")) return null;
    return path.join(this.uploadDir(), filename);
  }

  // ── Internals ────────────────────────────────────────────────────────────
  private blogData(input: BlogInput): Prisma.CmsBlogPostUncheckedCreateInput {
    return {
      slug: input.slug,
      title: input.title,
      date: input.date,
      excerpt: input.excerpt,
      kicker: input.kicker ?? null,
      readingMinutes: input.readingMinutes ?? null,
      author: input.author ?? null,
      image: input.image ?? null,
      imageAlt: input.imageAlt ?? null,
      body: input.body as unknown as Prisma.InputJsonValue,
    };
  }

  private newsData(input: NewsInput): Prisma.CmsNewsPostUncheckedCreateInput {
    return {
      slug: input.slug,
      title: input.title,
      date: input.date,
      tag: input.tag,
      excerpt: input.excerpt,
      image: input.image ?? null,
      imageAlt: input.imageAlt ?? null,
      body: input.body as unknown as Prisma.InputJsonValue,
    };
  }

  private jobData(input: JobInput): Prisma.CmsJobPostingUncheckedCreateInput {
    return {
      slug: input.slug,
      title: input.title,
      location: input.location,
      type: input.type,
      employmentType: input.employmentType,
      excerpt: input.excerpt,
      body: input.body as unknown as Prisma.InputJsonValue,
      applyEmail: input.applyEmail,
    };
  }

  /** Keep the first publish timestamp; null until first published. */
  private nextPublishedAt(
    previous: EnumCmsContentStatus,
    next: EnumCmsContentStatus,
    existingAt: Date | null,
  ): Date | null {
    if (next === EnumCmsContentStatus.PUBLISHED) {
      return existingAt ?? new Date();
    }
    return existingAt; // unpublishing keeps the history
  }

  private async assertSlugFree(section: CmsSection, slug: string, exceptId?: string): Promise<void> {
    const tables = {
      blog: () => this.prisma.cmsBlogPost.findUnique({ where: { slug } }),
      news: () => this.prisma.cmsNewsPost.findUnique({ where: { slug } }),
      careers: () => this.prisma.cmsJobPosting.findUnique({ where: { slug } }),
    } as const;
    const row = await tables[section]();
    if (row && row.id !== exceptId) {
      throw new common.ConflictException(
        `The URL slug "${slug}" is already taken — pick a different one.`,
      );
    }
  }

  /** Best-effort audit trail; an audit write failure never fails the op. */
  private async audit(
    verb: "created" | "updated" | "deleted",
    section: CmsSection | "media",
    row: { id?: string; slug?: string | null; title?: string | null; status?: EnumCmsContentStatus | null },
    userId?: string,
    before?: { slug: string; title: string; status: EnumCmsContentStatus | null },
  ): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.OTHER,
          actorType: EnumAdminAuditLogActorType.USER,
          actorUserId: userId ?? null,
          reason: `CMS ${verb} ${section}: ${row.slug ?? row.id ?? "?"}`,
          beforeJson: before
            ? (before as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          afterJson: {
            slug: row.slug ?? null,
            title: row.title ?? null,
            status: row.status ?? null,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(
        `CMS audit write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
