import { Global, Module } from "@nestjs/common";
import { AppEventsService } from "./appEvents.service";

/**
 * Global leaf module — zero dependencies, so ANY module can inject
 * AppEventsService without creating (or ever being able to create) a
 * dependency cycle. See appEvents.service.ts for the design contract.
 */
@Global()
@Module({
  providers: [AppEventsService],
  exports: [AppEventsService],
})
export class AppEventsModule {}
