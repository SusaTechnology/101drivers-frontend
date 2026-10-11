import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { FileInterceptor } from "@nestjs/platform-express";
import * as multer from "multer";
import type { Request, Response } from "express";

import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { CmsService } from "./cms.service";
import {
  BlogInput,
  JobInput,
  NewsInput,
  validateBlogInput,
  validateJobInput,
  validateNewsInput,
} from "./cms.validators";

/**
 * CMS controller — blog / news / careers content + media library.
 *
 * PUBLIC (no auth; Cache-Control 60s):
 *   GET /api/cms/blog                 → { posts: BlogPost[] }   (published)
 *   GET /api/cms/blog/:slug           → BlogPost | 404
 *   GET /api/cms/news                 → { posts: NewsPost[] }
 *   GET /api/cms/news/:slug
 *   GET /api/cms/careers              → { roles: JobPosting[] }
 *   GET /api/cms/careers/:slug
 *   GET /api/cms/media/file/:name     → uploaded image (immutable cache)
 *
 * ADMIN (same guard as the content controller — DefaultAuthGuard + ACGuard):
 *   GET    /api/cms/admin/blog|news|careers          (all statuses)
 *   POST   /api/cms/admin/blog|news|careers
 *   PATCH  /api/cms/admin/blog|news|careers/:id      (partial update incl. status)
 *   DELETE /api/cms/admin/blog|news|careers/:id
 *   POST   /api/cms/admin/media                      (multipart, field "file")
 *   GET    /api/cms/admin/media
 *   DELETE /api/cms/admin/media/:id
 *
 * Validation lives in cms.validators.ts; drafts may be saved empty, publishing
 * requires content. The stored shapes mirror the FE registry types 1:1 and are
 * rendered as React nodes — no raw HTML ever, so there is no XSS surface here.
 */

const CACHE_PUBLIC = "public, max-age=60";

@swagger.ApiTags("cms")
@common.Controller("cms")
export class CmsController {
  private static readonly MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

  constructor(private readonly cms: CmsService) {}

  private userId(request: Request): string | undefined {
    // req.user = { id, username, roles } from the JWT (see DefaultAuthGuard).
    const caller = request?.user as { id?: string } | undefined;
    return caller?.id;
  }

  // ── Public content ───────────────────────────────────────────────────────
  @common.Get("blog")
  @common.Header("Cache-Control", CACHE_PUBLIC)
  async listBlog() {
    return { posts: await this.cms.listPublicBlog() };
  }

  @common.Get("blog/:slug")
  @common.Header("Cache-Control", CACHE_PUBLIC)
  async getBlogPost(@common.Param("slug") slug: string) {
    const post = await this.cms.getPublicBlogPost(slug);
    if (!post) throw new common.NotFoundException("Blog post not found.");
    return post;
  }

  @common.Get("news")
  @common.Header("Cache-Control", CACHE_PUBLIC)
  async listNews() {
    return { posts: await this.cms.listPublicNews() };
  }

  @common.Get("news/:slug")
  @common.Header("Cache-Control", CACHE_PUBLIC)
  async getNewsPost(@common.Param("slug") slug: string) {
    const post = await this.cms.getPublicNewsPost(slug);
    if (!post) throw new common.NotFoundException("News item not found.");
    return post;
  }

  @common.Get("careers")
  @common.Header("Cache-Control", CACHE_PUBLIC)
  async listCareers() {
    return { roles: await this.cms.listPublicCareers() };
  }

  @common.Get("careers/:slug")
  @common.Header("Cache-Control", CACHE_PUBLIC)
  async getCareer(@common.Param("slug") slug: string) {
    const role = await this.cms.getPublicJobPosting(slug);
    if (!role) throw new common.NotFoundException("Job posting not found.");
    return role;
  }

  // ── Public media serving ─────────────────────────────────────────────────
  @common.Get("media/file/:filename")
  async serveMedia(
    @common.Param("filename") filename: string,
    @common.Res() res: Response,
  ) {
    const absPath = this.cms.resolveMediaPath(filename);
    if (!absPath) throw new common.NotFoundException("Image not found.");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(absPath, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(404).json({ message: "Image not found." });
        }
      }
    });
  }

  // ── Admin: blog ──────────────────────────────────────────────────────────
  @common.Get("admin/blog")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminListBlog() {
    return { posts: await this.cms.listAdminBlog() };
  }

  @common.Post("admin/blog")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminCreateBlog(
    @common.Body() body: Record<string, unknown>,
    @common.Req() request: Request,
  ) {
    if (!body || typeof body !== "object") {
      throw new common.BadRequestException("Body is required.");
    }
    const input: BlogInput = validateBlogInput(body, { requireBody: false });
    return this.cms.createBlog(input, this.userId(request));
  }

  @common.Patch("admin/blog/:id")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminUpdateBlog(
    @common.Param("id") id: string,
    @common.Body() body: Record<string, unknown>,
    @common.Req() request: Request,
  ) {
    // Validate the MERGED document server-side: the patch may flip status to
    // PUBLISHED, at which point the (existing ∪ patched) body must be complete.
    const existing = (await this.cms.listAdminBlog()).find(
      (row) => (row as { id: string }).id === id,
    );
    if (!existing) throw new common.NotFoundException("Blog post not found.");
    const merged = { ...(existing as Record<string, unknown>), ...body };
    const patch: Partial<BlogInput> = validateBlogInput(merged, {
      requireBody: merged.status === "PUBLISHED",
    });
    return this.cms.updateBlog(id, patch, this.userId(request));
  }

  @common.Delete("admin/blog/:id")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminDeleteBlog(@common.Param("id") id: string, @common.Req() request: Request) {
    await this.cms.removeSection("blog", id, this.userId(request));
    return { success: true };
  }

  // ── Admin: news ──────────────────────────────────────────────────────────
  @common.Get("admin/news")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminListNews() {
    return { posts: await this.cms.listAdminNews() };
  }

  @common.Post("admin/news")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminCreateNews(
    @common.Body() body: Record<string, unknown>,
    @common.Req() request: Request,
  ) {
    if (!body || typeof body !== "object") {
      throw new common.BadRequestException("Body is required.");
    }
    const input: NewsInput = validateNewsInput(body, { requireBody: false });
    return this.cms.createNews(input, this.userId(request));
  }

  @common.Patch("admin/news/:id")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminUpdateNews(
    @common.Param("id") id: string,
    @common.Body() body: Record<string, unknown>,
    @common.Req() request: Request,
  ) {
    const existing = (await this.cms.listAdminNews()).find(
      (row) => (row as { id: string }).id === id,
    );
    if (!existing) throw new common.NotFoundException("News item not found.");
    const merged = { ...(existing as Record<string, unknown>), ...body };
    const patch: Partial<NewsInput> = validateNewsInput(merged, {
      requireBody: merged.status === "PUBLISHED",
    });
    return this.cms.updateNews(id, patch, this.userId(request));
  }

  @common.Delete("admin/news/:id")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminDeleteNews(@common.Param("id") id: string, @common.Req() request: Request) {
    await this.cms.removeSection("news", id, this.userId(request));
    return { success: true };
  }

  // ── Admin: careers ───────────────────────────────────────────────────────
  @common.Get("admin/careers")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminListCareers() {
    return { roles: await this.cms.listAdminCareers() };
  }

  @common.Post("admin/careers")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminCreateCareer(
    @common.Body() body: Record<string, unknown>,
    @common.Req() request: Request,
  ) {
    if (!body || typeof body !== "object") {
      throw new common.BadRequestException("Body is required.");
    }
    const input: JobInput = validateJobInput(body, { requireBody: false });
    return this.cms.createCareer(input, this.userId(request));
  }

  @common.Patch("admin/careers/:id")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminUpdateCareer(
    @common.Param("id") id: string,
    @common.Body() body: Record<string, unknown>,
    @common.Req() request: Request,
  ) {
    const existing = (await this.cms.listAdminCareers()).find(
      (row) => (row as { id: string }).id === id,
    );
    if (!existing) throw new common.NotFoundException("Job posting not found.");
    const merged = { ...(existing as Record<string, unknown>), ...body };
    const patch: Partial<JobInput> = validateJobInput(merged, {
      requireBody: merged.status === "PUBLISHED",
    });
    return this.cms.updateCareer(id, patch, this.userId(request));
  }

  @common.Delete("admin/careers/:id")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminDeleteCareer(@common.Param("id") id: string, @common.Req() request: Request) {
    await this.cms.removeSection("careers", id, this.userId(request));
    return { success: true };
  }

  // ── Admin: media library ─────────────────────────────────────────────────
  @common.Post("admin/media")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  @common.UseInterceptors(
    FileInterceptor("file", {
      storage: multer.memoryStorage(),
      limits: { fileSize: CmsController.MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  async adminUploadMedia(
    @common.UploadedFile() file: { buffer: Buffer; mimetype: string; size: number; originalname: string } | undefined,
    @common.Req() request: Request,
  ) {
    if (!file) throw new common.BadRequestException("No image received — attach a file under the \"file\" field.");
    return this.cms.uploadMedia(file, this.userId(request));
  }

  @common.Get("admin/media")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminListMedia() {
    return { assets: await this.cms.listMedia() };
  }

  @common.Delete("admin/media/:id")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async adminDeleteMedia(@common.Param("id") id: string, @common.Req() request: Request) {
    await this.cms.removeMedia(id, this.userId(request));
    return { success: true };
  }
}
