import { Module, forwardRef } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { TrackingGateway } from "./tracking.gateway";
import { WsJwtGuard } from "../auth/guards/ws-jwt.guard";
import { DeliveryLogisticsModule } from "../delivery-logistics/delivery-logistics.module";

@Module({
  imports: [JwtModule.register({}), forwardRef(() => DeliveryLogisticsModule)],
  providers: [TrackingGateway, WsJwtGuard, JwtService],
  exports: [TrackingGateway],
})
export class GatewayModule {}
