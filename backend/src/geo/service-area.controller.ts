/**
 * Admin endpoints for the ONE service-area polygon (LA metro).
 *
 *  GET   /api/admin/service-area           → polygon + live badge stats
 *  POST  /api/admin/service-area/preview   → dry-run flip counts (confirm dialog)
 *  PUT   /api/admin/service-area           → validate + save + re-evaluate all
 *
 * PUT rejects invalid shapes (self-intersections, bad vertices) BEFORE the
 * polygon row or any driver badge is touched.
 */
import { Body, Controller, Get, Post, Put, Request, UseGuards } from "@nestjs/common";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AdminGuard } from "../auth/adminAuth.guard";
import { LatLng } from "./service-area.geometry";
import { ServiceAreaService } from "./service-area.service";

@UseGuards(defaultAuthGuard.DefaultAuthGuard, AdminGuard)
@Controller("admin/service-area")
export class ServiceAreaController {
  constructor(private readonly serviceArea: ServiceAreaService) {}

  @Get()
  async getPolygon() {
    const [polygon, stats] = await Promise.all([
      this.serviceArea.getPolygon(),
      this.serviceArea.getStats(),
    ]);
    return { polygon, stats };
  }

  @Post("preview")
  async preview(@Body() body: { coords: LatLng[] }) {
    const summary = await this.serviceArea.previewPolygon(body?.coords ?? []);
    return { summary };
  }

  @Put()
  async save(
    @Request() req: { user?: { id?: string } },
    @Body() body: { name?: string; coords: LatLng[] },
  ) {
    const { polygon, summary } = await this.serviceArea.savePolygon({
      name: body?.name,
      coords: body?.coords ?? [],
      actorUserId: req?.user?.id ?? null,
    });
    return { polygon, summary };
  }
}
