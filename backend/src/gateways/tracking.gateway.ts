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
 *   public:<trackingToken>  — unauthenticated tracking link viewers
 *   dealer:<dealerId>       — dealer dashboard receives status + new delivery events
 *   driver-feed             — all drivers viewing the gig board
 *   user:<userId>           — per-user room for personal notifications (bell dropdown)
 *
 * Events emitted (server → client):
 *   delivery:location-update  { deliveryId, lat, lng, recordedAt, drivenMiles }
 *   delivery:status-changed   { deliveryId, status, lockInRetained?, lockInAmount?, lockInDriverSharePct? }
 *   delivery:feed-update      { deliveryId, status, bookedByDriverId }
 *   delivery:created          { delivery (summary object) }
 *   notification:created      { id, type, subject, body, deliveryId?, customerId?, driverId?, createdAt, payload? }
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

  /** Authenticated: user joins their own personal notification room.
   *  Used by the NotificationBell dropdown to receive `notification:created`
   *  events in real time (instead of polling the REST inbox endpoint). */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join:user")
  handleJoinUser(@ConnectedSocket() client: Socket) {
    const userId = (client as AuthenticatedSocket).user?.sub;
    if (!userId) {
      return { joined: null, reason: "no_user_id" };
    }
    const room = `user:${userId}`;
    client.join(room);
    this.logger.debug(`User ${userId} joined ${room}`);
    return { joined: room };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("leave:user")
  handleLeaveUser(@ConnectedSocket() client: Socket) {
    const userId = (client as AuthenticatedSocket).user?.sub;
    if (!userId) {
      return { left: null };
    }
    const room = `user:${userId}`;
    client.leave(room);
    return { left: room };
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

    // ── 0. Server-side GPS sanity checks ──
    const lat = Number(data.lat);
    const lng = Number(data.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { ok: false, reason: "invalid_coordinates" };
    }

    // Null-island rejection: GPS chips return (0,0) area on cold start
    if (Math.abs(lat) < 1 && Math.abs(lng) < 1) {
      return { ok: false, reason: "null_island_rejected" };
    }

    // ── 1. Fast read-only lookup to get room info ──
    let deliveryId: string | null = null;
    let shareToken: string | undefined;
    try {
      const lookup = await this.lifecycleService.getActiveDeliveryForDriver(user!.sub);
      deliveryId = lookup.deliveryId;
      shareToken = lookup.shareToken ?? undefined;
    } catch (err: any) {
      this.logger.warn(`Quick delivery lookup failed: ${err.message}`);
    }

    // ── 2. Emit socket event IMMEDIATELY (before DB write) ──
    // Emit whenever there's an active delivery — don't gate on sessionStarted.
    // The tracking session is created lazily by ingestDriverLocation on the first ping.
    // If we waited for sessionStarted, the dealer would see a 3-6s black hole
    // after the delivery goes ACTIVE (first GPS reading silently dropped).
    if (deliveryId) {
      this.emitLocationUpdate({
        deliveryId,
        lat,
        lng,
        recordedAt: data.recordedAt || new Date().toISOString(),
        drivenMiles: null,
        shareToken,
      });
    }

    // ── 3. DB write in background (fire-and-forget) ──
    this.lifecycleService.ingestDriverLocation({
      userId: user!.sub,
      lat,
      lng,
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
    /** Optional lock-in context — included in the payload so the driver
     *  UI can show "your $X payout is secured" when a trip is cancelled
     *  after start. Forward-compatible: undefined on non-lock-in paths. */
    lockInRetained?: boolean;
    lockInAmount?: number | null;
    lockInDriverSharePct?: number | null;
  }) {
    if (!this.server) {
      this.logger.warn("emitStatusChange: server not initialized, skipping");
      return;
    }
    const payload: Record<string, unknown> = {
      deliveryId: data.deliveryId,
      status: data.status,
    };
    if (data.lockInRetained) {
      payload.lockInRetained = true;
      payload.lockInAmount = data.lockInAmount ?? null;
      payload.lockInDriverSharePct = data.lockInDriverSharePct ?? null;
    }

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

  /**
   * Push a `notification:created` event to a specific user's room so their
   * NotificationBell dropdown updates in real time without polling.
   *
   * Called from NotificationEventEngine.queueAndSend after the row is
   * persisted. Recipient resolution:
   *   - If actorUserId is set, push to that user (admin self-notification)
   *   - If customerId is set, push to the customer's user (via customer.user.id)
   *   - If driverId is set, push to the driver's user (via driver.user.id)
   *
   * The frontend NotificationBell listens on `notification:created` and
   * invalidates its inbox query, triggering a refetch.
   *
   * Note: the room join is opt-in — the frontend must explicitly emit
   * `join:user` after auth. If no socket is in the room, the event is
   * silently dropped (Socket.IO behavior), which is fine: the user will
   * still see the notification on the next poll.
   */
  async emitNotificationCreated(data: {
    userId: string;
    notification: {
      id: string;
      type: string;
      subject: string | null;
      body: string | null;
      deliveryId?: string | null;
      customerId?: string | null;
      driverId?: string | null;
      templateCode?: string | null;
      createdAt: Date;
      payload?: any;
    };
  }) {
    if (!this.server) {
      this.logger.warn("emitNotificationCreated: server not initialized, skipping");
      return;
    }
    const room = `user:${data.userId}`;
    this.server.to(room).emit("notification:created", {
      id: data.notification.id,
      type: data.notification.type,
      subject: data.notification.subject,
      body: data.notification.body,
      deliveryId: data.notification.deliveryId ?? null,
      customerId: data.notification.customerId ?? null,
      driverId: data.notification.driverId ?? null,
      templateCode: data.notification.templateCode ?? null,
      createdAt: data.notification.createdAt.toISOString(),
      payload: data.notification.payload ?? null,
    });
    this.logger.debug(
      `emitNotificationCreated -> room=${room} type=${data.notification.type} subject="${data.notification.subject ?? ""}"`
    );
  }
}
