import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { UseGuards, Logger, Optional, Inject, forwardRef } from "@nestjs/common";
import { WsJwtGuard } from "../auth/guards/ws-jwt.guard";
import { DeliveryLifecycleService } from "../delivery-logistics/delivery-lifecycle.service";

/** Socket augmented by WsJwtGuard with decoded JWT payload */
type AuthenticatedSocket = Socket & {
  user?: { sub: string; username?: string; roles?: string[] };
};

/**
 * WebSocket gateway for live tracking, delivery status, and driver feed.
 *
 * Rooms:
 *   delivery:<deliveryId>   — anyone tracking a specific delivery
 *   public:<trackingToken> — unauthenticated tracking link viewers
 *   dealer:<dealerId>      — dealer dashboard receives status + new delivery events
 *   driver-feed             — all drivers viewing the gig board
 *
 * Events emitted (server → client):
 *   delivery:location-update  { deliveryId, lat, lng, recordedAt, drivenMiles }
 *   delivery:status-changed   { deliveryId, status }
 *   delivery:feed-update      { deliveryId, status, bookedByDriverId }
 *   delivery:created          { delivery (summary object) }
 */
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: "/tracking",
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Optional() @Inject(forwardRef(() => DeliveryLifecycleService))
    private readonly lifecycleService?: DeliveryLifecycleService,
  ) {}

  afterInit() {
    this.logger.log("Tracking WebSocket gateway initialized");
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // ── Room join/leave handlers ──

  /** Authenticated: join a specific delivery tracking room */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join:delivery")
  handleJoinDelivery(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deliveryId: string },
  ) {
    const room = `delivery:${data.deliveryId}`;
    client.join(room);
    this.logger.debug(`User ${(client as AuthenticatedSocket).user?.sub} joined ${room}`);
    return { joined: room };
  }

  @SubscribeMessage("leave:delivery")
  handleLeaveDelivery(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deliveryId: string },
  ) {
    client.leave(`delivery:${data.deliveryId}`);
    return { left: `delivery:${data.deliveryId}` };
  }

  /** Unauthenticated: join public tracking room via share token */
  @SubscribeMessage("join:public")
  handleJoinPublic(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string },
  ) {
    const room = `public:${data.token}`;
    client.join(room);
    this.logger.debug(`Anonymous client ${client.id} joined ${room}`);
    return { joined: room };
  }

  @SubscribeMessage("leave:public")
  handleLeavePublic(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string },
  ) {
    client.leave(`public:${data.token}`);
    return { left: `public:${data.token}` };
  }

  /** Authenticated: dealer joins their dashboard room */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join:dealer")
  handleJoinDealer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dealerId: string },
  ) {
    const room = `dealer:${data.dealerId}`;
    client.join(room);
    this.logger.debug(`Dealer ${(client as AuthenticatedSocket).user?.sub} joined ${room}`);
    return { joined: room };
  }

  @SubscribeMessage("leave:dealer")
  handleLeaveDealer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dealerId: string },
  ) {
    client.leave(`dealer:${data.dealerId}`);
    return { left: `dealer:${data.dealerId}` };
  }

  /** Authenticated: driver joins the gig board feed room */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join:driver-feed")
  handleJoinDriverFeed(@ConnectedSocket() client: Socket) {
    client.join("driver-feed");
    this.logger.log(`Driver ${(client as AuthenticatedSocket).user?.sub} joined driver-feed`);
    return { joined: "driver-feed" };
  }

  @SubscribeMessage("leave:driver-feed")
  handleLeaveDriverFeed(@ConnectedSocket() client: Socket) {
    client.leave("driver-feed");
    return { left: "driver-feed" };
  }

  // ── Driver GPS location streaming ──

  /**
   * Receive GPS location from driver via socket.
   * Saves to DB, then broadcasts to dealer/public tracking rooms.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("driver:location")
  async handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lat: number; lng: number; recordedAt?: string; useLiveLocation?: boolean },
  ) {
    const user = (client as AuthenticatedSocket).user;

    if (!this.lifecycleService) {
      this.logger.warn("LifecycleService not available — skipping socket location ingest");
      return { ok: false, reason: "service_unavailable" };
    }

    // ── 1. Fast read-only lookup to get room info ──
    let deliveryId: string | null = null;
    let shareToken: string | undefined;
    let sessionStarted = false;
    try {
      const lookup = await this.lifecycleService.getActiveDeliveryForDriver(user!.sub);
      deliveryId = lookup.deliveryId;
      shareToken = lookup.shareToken ?? undefined;
      sessionStarted = lookup.sessionStarted;
    } catch (err: any) {
      this.logger.warn(`Quick delivery lookup failed: ${err.message}`);
    }

    // ── 2. Emit socket event IMMEDIATELY (before DB write) ──
    if (deliveryId && sessionStarted) {
      this.emitLocationUpdate({
        deliveryId,
        lat: Number(data.lat),
        lng: Number(data.lng),
        recordedAt: data.recordedAt || new Date().toISOString(),
        drivenMiles: null, // DB write will update this for the 15s poll fallback
        shareToken,
      });
    }

    // ── 3. DB write in background (fire-and-forget) ──
    // Writes the tracking point, updates driven miles, upserts driver location.
    // If it fails, the socket event was already sent — dealer still sees the update.
    this.lifecycleService.ingestDriverLocation({
      userId: user!.sub,
      lat: Number(data.lat),
      lng: Number(data.lng),
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : undefined,
      useLiveLocation: data.useLiveLocation === true,
    }).catch((err: any) => {
      this.logger.warn(`Background DB write for location failed: ${err.message}`);
    });

    return { ok: true };
  }

  // ── Server-side emit helpers (called from services) ──

  /** Broadcast location update to delivery + public rooms */
  emitLocationUpdate(data: {
    deliveryId: string;
    lat: number;
    lng: number;
    recordedAt: string;
    drivenMiles: number | null;
    shareToken?: string;
  }) {
    if (!this.server) {
      this.logger.warn("emitLocationUpdate: server not initialized, skipping");
      return;
    }
    const payload = {
      deliveryId: data.deliveryId,
      lat: data.lat,
      lng: data.lng,
      recordedAt: data.recordedAt,
      drivenMiles: data.drivenMiles,
    };

    this.server.to(`delivery:${data.deliveryId}`).emit("delivery:location-update", payload);

    if (data.shareToken) {
      this.server.to(`public:${data.shareToken}`).emit("delivery:location-update", payload);
    }
  }

  /** Broadcast status change to delivery + public + dealer rooms */
  emitStatusChange(data: {
    deliveryId: string;
    status: string;
    shareToken?: string;
    dealerId?: string;
  }) {
    if (!this.server) {
      this.logger.warn("emitStatusChange: server not initialized, skipping");
      return;
    }
    const payload = { deliveryId: data.deliveryId, status: data.status };

    this.server.to(`delivery:${data.deliveryId}`).emit("delivery:status-changed", payload);

    if (data.shareToken) {
      this.server.to(`public:${data.shareToken}`).emit("delivery:status-changed", payload);
    }

    if (data.dealerId) {
      this.server.to(`dealer:${data.dealerId}`).emit("delivery:status-changed", payload);
    }
  }

  /** Broadcast feed update to all drivers viewing the gig board */
  emitFeedUpdate(data: {
    deliveryId: string;
    status: string;
    bookedByDriverId?: string;
  }) {
    if (!this.server) {
      this.logger.warn("emitFeedUpdate: server not initialized, skipping");
      return;
    }
    this.server.to("driver-feed").emit("delivery:feed-update", {
      deliveryId: data.deliveryId,
      status: data.status,
      bookedByDriverId: data.bookedByDriverId ?? null,
    });
  }

  /** Notify dealer dashboard that a new delivery was created */
  emitNewDelivery(data: {
    deliveryId: string;
    dealerId: string;
    delivery: Record<string, any>;
  }) {
    if (!this.server) {
      this.logger.warn("emitNewDelivery: server not initialized, skipping");
      return;
    }
    this.server.to(`dealer:${data.dealerId}`).emit("delivery:created", {
      deliveryId: data.deliveryId,
      ...data.delivery,
    });
  }
}
