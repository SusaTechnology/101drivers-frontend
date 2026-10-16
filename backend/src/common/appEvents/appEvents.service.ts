/**
 * In-process pub/sub for cross-cutting "something happened" signals.
 *
 * WHY THIS EXISTS
 * Several features need to react to events that originate in modules they
 * must not depend on. Example: the admin Users-page stat cards want to
 * live-update when a new user signs up — but the signup lives in
 * AuthService, and AuthModule cannot import GatewayModule (the socket
 * gateway) because GatewayModule's dependency graph already reaches back
 * into AuthModule through
 *   GatewayModule -> DeliveryLogisticsModule -> ReferralModule -> AuthModule,
 * so a direct import would close a dependency cycle.
 *
 * An in-process event bus decouples BOTH sides: the emitter (auth, user
 * services) depends only on this leaf module, and the receiver (the socket
 * gateway) subscribes at boot. Adding a new emitter or listener never
 * touches module wiring.
 *
 * DESIGN
 *  - Deliberately TINY (no @nestjs/event-emitter dependency): synchronous,
 *    in-memory, fire-and-forget. Listeners are wrapped in try/catch — a
 *    broken listener can never break the business flow that emitted.
 *  - Events are CONTENTLESS pings ("stats changed somewhere"), not data
 *    payloads: receivers re-read server truth (e.g. refetch an endpoint)
 *    instead of trusting a broadcast. That keeps authorization in the
 *    normal request path — the bus never leaks data across users.
 *  - Same install/teardown contract as the rest of the codebase: subscribe
 *    in onModuleInit, unsubscribe in onModuleDestroy (StrictMode/HMR safe).
 */

import { Injectable, Logger } from "@nestjs/common";

export const APP_EVENT = {
  /** A user/role row was created or its status changed — admin Users-page
   *  stat cards and admin list caches should re-read server truth. */
  USER_STATS_CHANGED: "users:stats-changed",
} as const;

export type AppEventName = (typeof APP_EVENT)[keyof typeof APP_EVENT];

type AppEventListener = (event: AppEventName) => void;

@Injectable()
export class AppEventsService {
  private readonly logger = new Logger("AppEventsService");
  private readonly listeners = new Set<AppEventListener>();

  emit(event: AppEventName): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        // A listener failure must never break the emitter's business flow.
        this.logger.warn(
          `listener threw for ${event}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /** Returns an unsubscribe function (for onModuleDestroy). */
  on(listener: AppEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
