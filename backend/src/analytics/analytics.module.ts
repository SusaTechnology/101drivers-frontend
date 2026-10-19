import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

// Leaf module: PrismaModule and RateLimitModule are both @Global(), so no
// imports are needed for them. Nothing here imports business modules,
// which keeps AnalyticsModule dependency-free and cycle-proof — any
// module (auth, deliveryRequest, …) can import it safely.
@Module({
  imports: [
    // Same secret the auth JwtStrategy uses (jwt.strategy.ts) so public
    // PAGE_VIEW pings can be attributed to the session user. Verification
    // failure = anonymous visit — never a 401.
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? "",
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
