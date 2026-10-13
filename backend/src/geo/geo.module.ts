import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { ServiceAreaController } from "./service-area.controller";
import { ServiceAreaService } from "./service-area.service";

/**
 * Driver service-area: the ONE LA-metro polygon, per-driver derived
 * eligibility and the ops map editor endpoints. Deliberately imports
 * NOTHING app-specific (just Prisma + Config) so auth/driver/user modules
 * can import this one without creating dependency cycles.
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ServiceAreaController],
  providers: [ServiceAreaService],
  exports: [ServiceAreaService],
})
export class GeoModule {}
