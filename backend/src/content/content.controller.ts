import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Content Management Controller
 *
 * GET  /api/content/:key  — public, returns the stored content for a key
 * PUT  /api/content/:key  — admin only, updates the content
 *
 * Uses the existing AppSetting table (key = CONTENT_<KEY>, value = HTML string or JSON).
 * No schema changes, no migrations.
 *
 * Valid keys: privacy, terms, help-driver, help-customer
 */
@swagger.ApiTags("content")
@common.Controller("content")
export class ContentController {
  private static readonly VALID_KEYS = new Set([
    "privacy",
    "terms",
    "help-driver",
    "help-customer",
  ]);

  private static readonly PREFIX = "CONTENT_";

  constructor(private readonly prisma: PrismaService) {}

  private toDbKey(key: string): string {
    return `${ContentController.PREFIX}${key.toUpperCase()}`;
  }

  private isValidKey(key: string): boolean {
    return ContentController.VALID_KEYS.has(key.toLowerCase());
  }

  /**
   * GET /api/content/:key
   * Public — returns { key, content } or { key, content: null } if not set.
   */
  @common.Get(":key")
  async getContent(@common.Param("key") key: string) {
    if (!this.isValidKey(key)) {
      throw new common.NotFoundException(`Unknown content key: ${key}`);
    }

    const setting = await this.prisma.appSetting.findUnique({
      where: { key: this.toDbKey(key) },
    });

    if (!setting) {
      return { key, content: null };
    }

    const val = setting.value as any;
    const content = typeof val === "string" ? val : val;

    return { key, content };
  }

  /**
   * PUT /api/content/:key
   * Admin only — updates the content.
   * Body: { content: string | any[] }
   */
  @common.Put(":key")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async updateContent(
    @common.Param("key") key: string,
    @common.Body() body: { content: any }
  ) {
    if (!this.isValidKey(key)) {
      throw new common.NotFoundException(`Unknown content key: ${key}`);
    }

    if (!body || body.content === undefined) {
      throw new common.BadRequestException("Content is required");
    }

    const dbKey = this.toDbKey(key);
    const value = body.content as any;

    await this.prisma.appSetting.upsert({
      where: { key: dbKey },
      update: { value },
      create: { key: dbKey, value },
    });

    return { success: true, key, message: "Content updated successfully." };
  }
}
