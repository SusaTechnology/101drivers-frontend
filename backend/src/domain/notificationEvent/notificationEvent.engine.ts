// src/domain/notificationEvent/notificationEvent.engine.ts
import { Injectable, Logger, Optional, Inject, forwardRef } from "@nestjs/common";
import {
  EnumNotificationEventChannel,
  EnumNotificationEventStatus,
  EnumNotificationEventType,
  EnumScheduleChangeRequestRequestedByRole,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../../common/mail/mail.service";
import { TrackingGateway } from "../../gateways/tracking.gateway";

type Tx = Prisma.TransactionClient;

type QueueNotificationInput = {
  actorUserId?: string | null;
  customerId?: string | null;
  deliveryId?: string | null;
  driverId?: string | null;

  channel: EnumNotificationEventChannel;
  type: EnumNotificationEventType;

  subject?: string | null;
  body?: string | null;
  templateCode?: string | null;

  toEmail?: string | null;
  toPhone?: string | null;

  payload?: Prisma.InputJsonValue | null;
};

@Injectable()
export class NotificationEventEngine {
  private readonly logger = new Logger(NotificationEventEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    @Optional() @Inject(forwardRef(() => TrackingGateway))
    private readonly trackingGateway?: TrackingGateway
  ) {}

  async queueAndSend(input: QueueNotificationInput) {
    const created = await this.prisma.notificationEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        customerId: input.customerId ?? null,
        deliveryId: input.deliveryId ?? null,
        driverId: input.driverId ?? null,
        channel: input.channel,
        type: input.type,
        status: EnumNotificationEventStatus.QUEUED,
        subject: input.subject ?? null,
        body: input.body ?? null,
        templateCode: input.templateCode ?? null,
        toEmail: input.toEmail ?? null,
        toPhone: input.toPhone ?? null,
        payload: input.payload ?? undefined,
      },
    });

    // Fire-and-forget: push `notification:created` to all relevant user rooms
    // so the NotificationBell dropdowns update in real time. We do this BEFORE
    // deliver() so the bell updates even if SMTP is slow / unconfigured.
    // Errors are swallowed on purpose — socket push is best-effort.
    this.broadcastNotificationCreated(created).catch((err) => {
      this.logger.debug(
        `broadcastNotificationCreated failed (non-fatal): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    });

    try {
      await this.deliver(created.id);

      return this.prisma.notificationEvent.findUniqueOrThrow({
        where: { id: created.id },
      });
    } catch (error) {
      this.logger.error(
        `Notification delivery failed for event ${created.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      return this.prisma.notificationEvent.findUniqueOrThrow({
        where: { id: created.id },
      });
    }
  }

  /**
   * Resolve all user IDs who should see this notification in their bell and
   * push a `notification:created` socket event to each user's room.
   *
   * Recipients:
   *   1. actorUserId (the user who triggered the action — e.g. admin who cancelled)
   *   2. customer.user.id (the customer the notification is about)
   *   3. driver.user.id (the driver the notification is about)
   *
   * The bell's REST query already includes actorUserId; the customer/driver
   * visibility is added in NotificationEventService.getMyNotificationEvents
   * via an OR clause on customer.userId / driver.userId.
   */
  private async broadcastNotificationCreated(event: {
    id: string;
    actorUserId: string | null;
    customerId: string | null;
    driverId: string | null;
    deliveryId: string | null;
    type: EnumNotificationEventType;
    subject: string | null;
    body: string | null;
    templateCode: string | null;
    createdAt: Date;
    payload?: Prisma.JsonValue | null;
  }) {
    if (!this.trackingGateway) {
      return;
    }

    const userIds = new Set<string>();

    if (event.actorUserId) {
      userIds.add(event.actorUserId);
    }

    if (event.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: event.customerId },
        select: { userId: true },
      });
      if (customer?.userId) {
        userIds.add(customer.userId);
      }
    }

    if (event.driverId) {
      const driver = await this.prisma.driver.findUnique({
        where: { id: event.driverId },
        select: { userId: true },
      });
      if (driver?.userId) {
        userIds.add(driver.userId);
      }
    }

    if (userIds.size === 0) {
      return;
    }

    const notificationPayload = {
      id: event.id,
      type: event.type,
      subject: event.subject,
      body: event.body,
      deliveryId: event.deliveryId,
      customerId: event.customerId,
      driverId: event.driverId,
      templateCode: event.templateCode,
      createdAt: event.createdAt,
      payload: event.payload ?? null,
    };

    for (const userId of userIds) {
      await this.trackingGateway.emitNotificationCreated({
        userId,
        notification: notificationPayload,
      });
    }
  }

  async deliver(notificationEventId: string) {
    const event = await this.prisma.notificationEvent.findUnique({
      where: { id: notificationEventId },
      select: {
        id: true,
        channel: true,
        status: true,
        subject: true,
        body: true,
        toEmail: true,
        toPhone: true,
      },
    });

    if (!event) {
      throw new Error("NotificationEvent not found");
    }

    if (event.status !== EnumNotificationEventStatus.QUEUED) {
      return;
    }

    try {
      if (event.channel === EnumNotificationEventChannel.EMAIL) {
        if (!event.toEmail) {
          throw new Error("toEmail is required for EMAIL notifications");
        }

        if (!this.mailService.isConfigured) {
          this.logger.warn(
            `Email delivery skipped (SMTP not configured): event=${event.id}, to=${event.toEmail}`
          );
          await this.prisma.notificationEvent.update({
            where: { id: event.id },
            data: {
              status: EnumNotificationEventStatus.FAILED,
              failedAt: new Date(),
              errorMessage: "SMTP not configured",
            },
          });
          return;
        }

        await this.mailService.sendMail({
          to: event.toEmail,
          subject: event.subject ?? "101 Drivers Notification",
          text: event.body ?? "",
          html: this.wrapSimpleHtml(
            event.subject ?? "Notification",
            event.body ?? ""
          ),
        });
      } else if (event.channel === EnumNotificationEventChannel.SMS) {
        if (!event.toPhone) {
          throw new Error("toPhone is required for SMS notifications");
        }

        throw new Error("SMS delivery is not implemented yet");
      }

      await this.prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          status: EnumNotificationEventStatus.SENT,
          sentAt: new Date(),
          failedAt: null,
          errorMessage: null,
        },
      });
    } catch (error) {
      await this.prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          status: EnumNotificationEventStatus.FAILED,
          failedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  async notifyDeliveryCreated(input: {
    deliveryId: string;
    actorUserId?: string | null;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        serviceType: true,
        pickupAddress: true,
        dropoffAddress: true,
        trackingShareToken: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new Error("Delivery not found");
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    if (!toEmail) {
      return null;
    }

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      "Customer";

    return this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_STATUS_CHANGED,
      templateCode: "delivery-created",
      toEmail,
      subject: "Your delivery request has been created",
      body: [
        `Hi ${displayName},`,
        "",
        `Your delivery request has been created successfully.`,
        `Status: ${delivery.status}`,
        `Service: ${delivery.serviceType}`,
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        delivery.trackingShareToken
          ? `Tracking token: ${delivery.trackingShareToken}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
        serviceType: delivery.serviceType,
      },
    });
  }

  async notifyDeliveryReleased(input: {
    deliveryId: string;
    actorUserId?: string | null;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new Error("Delivery not found");
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    if (!toEmail) {
      return null;
    }

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      "Customer";

    return this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_STATUS_CHANGED,
      templateCode: "delivery-listed",
      toEmail,
      subject: "Your delivery is now listed",
      body: [
        `Hi ${displayName},`,
        "",
        `Your delivery is now available in the marketplace for drivers.`,
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
      },
    });
  }

  async notifyDriverBooked(input: {
    deliveryId: string;
    driverId: string;
    actorUserId?: string | null;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
        assignments: {
          where: {
            driverId: input.driverId,
            unassignedAt: null,
          },
          take: 1,
          select: {
            driver: {
              select: {
                id: true,
                phone: true,
                user: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new Error("Delivery not found");
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    if (!toEmail) {
      return null;
    }

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      "Customer";

    const assignedDriver = delivery.assignments?.[0]?.driver;
    const driverName = assignedDriver?.user?.fullName ?? "Driver";

    return this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      driverId: input.driverId,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_BOOKED,
      templateCode: "delivery-booked",
      toEmail,
      subject: "A driver booked your delivery",
      body: [
        `Hi ${displayName},`,
        "",
        `${driverName} has booked your delivery request.`,
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        driverId: input.driverId,
        status: delivery.status,
      },
    });
  }

async notifyTripStarted(input: {
  deliveryId: string;
  driverId?: string;
  actorUserId?: string | null;
  trackingUrl: string;
  expiresAt?: Date | null;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      recipientEmail: true,
      recipientName: true,
      trackingShareToken: true,
      trackingShareExpiresAt: true,
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          businessName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
      assignments: {
        where: { unassignedAt: null },
        take: 1,
        select: {
          driver: {
            select: {
              id: true,
              user: {
                select: {
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    delivery.customer?.businessName ??
    "Customer";

  const assignedDriver = delivery.assignments?.[0]?.driver;
  const driverEmail = assignedDriver?.user?.email ?? null;
  const driverName = assignedDriver?.user?.fullName ?? "Driver";

  const linkButtonHtml = `<div style="margin: 20px 0;"><a href="${this.escapeHtml(input.trackingUrl)}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Track Delivery</a></div>`;

  // CUSTOMER EMAIL
  if (customerEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.TRACKING_STARTED,
      templateCode: "trip-started-customer",
      toEmail: customerEmail,
      subject: "Your vehicle delivery is in progress",
      body: [
        `Hi ${customerName},`,
        "",
        "Your driver has started the trip.",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
        "",
        `Tracking link: ${input.trackingUrl}`,
        delivery.trackingShareExpiresAt
          ? `Link expires at: ${delivery.trackingShareExpiresAt.toISOString()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
        trackingUrl: input.trackingUrl,
      },
    });
  }

  // RECIPIENT EMAIL
  if (delivery.recipientEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.TRACKING_STARTED,
      templateCode: "trip-started-recipient",
      toEmail: delivery.recipientEmail,
      subject: "Vehicle delivery tracking is now live",
      body: [
        `Hi ${delivery.recipientName ?? "Recipient"},`,
        "",
        "The vehicle delivery is now in progress.",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
        "",
        `Tracking link: ${input.trackingUrl}`,
        delivery.trackingShareExpiresAt
          ? `Link expires at: ${delivery.trackingShareExpiresAt.toISOString()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
        trackingUrl: input.trackingUrl,
      },
    });
  }

  // DRIVER EMAIL — no tracking link, just a trip-started confirmation
  if (driverEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.TRACKING_STARTED,
      templateCode: "trip-started-driver",
      toEmail: driverEmail,
      subject: "Trip started",
      body: [
        `Hi ${driverName},`,
        "",
        "You have started your delivery. Safe travels!",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
      },
    });
  }

  return true;
}

/**
 * Notify the customer that their card was partially captured at trip start
 * (the non-refundable base fee). This closes the "surprise statement" gap —
 * previously the customer only learned about the base fee if they later
 * cancelled. Now they get an upfront email + in-app notification the moment
 * the driver starts the trip.
 *
 * Skips silently if no customer email is available.
 */
async notifyLockInCaptured(input: {
  deliveryId: string;
  actorUserId?: string | null;
  driverId?: string | null;
  /** The base fee amount captured (in dollars). */
  lockInAmount: number;
  /** Driver's share % at the time of lock-in. */
  driverSharePct?: number | null;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
      assignments: {
        where: {
          ...(input.driverId ? { driverId: input.driverId } : {}),
        },
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          driver: {
            select: {
              id: true,
              user: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    "Customer";

  const driverName =
    delivery.assignments?.[0]?.driver?.user?.fullName ?? "your driver";

  if (!customerEmail) {
    this.logger.debug(
      `notifyLockInCaptured: no customer email for delivery ${input.deliveryId}, skipping email`
    );
    return false;
  }

  const lockInAmount = Number(input.lockInAmount ?? 0);
  if (lockInAmount <= 0) {
    return false;
  }

  const bodyLines = [
    `Hi ${customerName},`,
    "",
    `${driverName} has started your delivery. The trip is now in progress.`,
    `Pickup: ${delivery.pickupAddress}`,
    `Drop-off: ${delivery.dropoffAddress}`,
    "",
    "Base fee captured",
    `A non-refundable base fee of $${lockInAmount.toFixed(2)} has been charged to your card. This compensates the driver for arriving and starting the trip.`,
    "The remaining balance will be charged when the delivery is completed. If the trip is cancelled after this point, the base fee is non-refundable.",
    "You can track your driver's progress in real time from your dashboard.",
  ];

  await this.queueAndSend({
    actorUserId: input.actorUserId ?? null,
    customerId: delivery.customerId,
    deliveryId: delivery.id,
    driverId: input.driverId ?? null,
    channel: EnumNotificationEventChannel.EMAIL,
    type: EnumNotificationEventType.PAYMENT_CAPTURED,
    templateCode: "lock-in-captured-customer",
    toEmail: customerEmail,
    subject: `Your driver has started — base fee of $${lockInAmount.toFixed(2)} captured`,
    body: bodyLines.join("\n"),
    payload: {
      deliveryId: delivery.id,
      status: delivery.status,
      lockInCaptured: true,
      lockInAmount,
      driverSharePct: input.driverSharePct ?? null,
    },
  });

  return true;
}

async notifyTripCompleted(input: {
  deliveryId: string;
  actorUserId?: string | null;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      recipientEmail: true,
      recipientName: true,
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          businessName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    delivery.customer?.businessName ??
    "Customer";

  if (customerEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.TRACKING_STOPPED,
      templateCode: "trip-completed-customer",
      toEmail: customerEmail,
      subject: "Your vehicle delivery is complete",
      body: [
        `Hi ${customerName},`,
        "",
        "Your vehicle delivery has been completed.",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
      },
    });
  }

  if (delivery.recipientEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.TRACKING_STOPPED,
      templateCode: "trip-completed-recipient",
      toEmail: delivery.recipientEmail,
      subject: "Vehicle delivery is complete",
      body: [
        `Hi ${delivery.recipientName ?? "Recipient"},`,
        "",
        "The vehicle delivery has been completed.",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
      },
    });
  }

  // ── Schedule a follow-up email ~18 hours later reminding to rate/tip ──
  if (customerEmail) {
    const deliveryId = delivery.id;
    const name = customerName;
    const email = customerEmail;
    // 18 hours = 64,800,000 ms — within the 12-24h window requested
    setTimeout(async () => {
      try {
        // Check if already rated before sending reminder
        const existingRating = await this.prisma.deliveryRating.findFirst({
          where: { deliveryId },
        });
        if (existingRating) return; // already rated, skip reminder

        await this.mailService.sendMail({
          to: email,
          subject: "How was your delivery? Rate your driver",
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 480px; margin: 0 auto;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 24px; font-weight: 800; color: #111;">101 Drivers</div>
              </div>
              <p style="font-size: 16px;">Hi ${name},</p>
              <p style="font-size: 16px;">Your delivery was completed yesterday. We'd love to hear how it went!</p>
              <p style="font-size: 16px;">Your feedback helps us maintain quality and helps drivers improve.</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://101drivers.techbee.et"
                   style="display: inline-block; padding: 14px 32px; background: #111; color: #fff; text-decoration: none; border-radius: 12px; font-size: 16px; font-weight: 700;">
                  Go to 101 Drivers to Rate
                </a>
              </div>
              <p style="font-size: 13px; color: #888; margin-top: 24px;">
                You can rate your driver from the delivery details page in your dashboard.
              </p>
            </div>
          `,
        });
        this.logger.log(`Rating reminder email sent for delivery ${deliveryId}`);
      } catch (err: any) {
        this.logger.warn(`Failed to send rating reminder for ${deliveryId}: ${err.message}`);
      }
    }, 18 * 60 * 60 * 1000);
  }

  return true;
}
  async notifyScheduleChangeRequested(input: {
    deliveryId: string;
    actorUserId?: string | null;
    requestedByRole?: EnumScheduleChangeRequestRequestedByRole | null;
    reason?: string | null;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        dropoffWindowStart: true,
        dropoffWindowEnd: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            businessName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new Error("Delivery not found");
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    if (!toEmail) {
      return null;
    }

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      delivery.customer?.businessName ??
      "Customer";

    const requestedByRoleLabel = input.requestedByRole
      ? String(input.requestedByRole).replaceAll("_", " ")
      : "Unknown";

    return this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.SCHEDULE_CHANGE_REQUESTED,
      templateCode: "schedule-change-requested",
      toEmail,
      subject: "Schedule change requested for your delivery",
      body: [
        `Hi ${displayName},`,
        "",
        `A schedule change has been requested for your delivery.`,
        `Requested by: ${requestedByRoleLabel}`,
        input.reason ? `Reason: ${input.reason}` : "",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Current pickup window: ${this.formatWindow(
          delivery.pickupWindowStart,
          delivery.pickupWindowEnd
        )}`,
        `Current drop-off window: ${this.formatWindow(
          delivery.dropoffWindowStart,
          delivery.dropoffWindowEnd
        )}`,
        `Status: ${delivery.status}`,
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
        requestedByRole: input.requestedByRole ?? null,
        reason: input.reason ?? null,
      },
    });
  }

  async notifyScheduleChangeDecided(input: {
    deliveryId: string;
    actorUserId?: string | null;
    outcome: "APPROVED" | "DECLINED" | "CANCELLED";
    decisionNote?: string | null;
    requestedByUserId?: string | null;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        dropoffWindowStart: true,
        dropoffWindowEnd: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            businessName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new Error("Delivery not found");
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    if (!toEmail) {
      return null;
    }

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      delivery.customer?.businessName ??
      "Customer";

    const templateCode =
      input.outcome === "APPROVED"
        ? "schedule-change-approved"
        : input.outcome === "DECLINED"
        ? "schedule-change-declined"
        : "schedule-change-cancelled";

    const subject =
      input.outcome === "APPROVED"
        ? "Your schedule change was approved"
        : input.outcome === "DECLINED"
        ? "Your schedule change was declined"
        : "Your schedule change was cancelled";

    const intro =
      input.outcome === "APPROVED"
        ? "The requested schedule change has been approved."
        : input.outcome === "DECLINED"
        ? "The requested schedule change has been declined."
        : "The pending schedule change has been cancelled.";

    return this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.SCHEDULE_CHANGE_DECIDED,
      templateCode,
      toEmail,
      subject,
      body: [
        `Hi ${displayName},`,
        "",
        intro,
        input.decisionNote ? `Note: ${input.decisionNote}` : "",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Pickup window: ${this.formatWindow(
          delivery.pickupWindowStart,
          delivery.pickupWindowEnd
        )}`,
        `Drop-off window: ${this.formatWindow(
          delivery.dropoffWindowStart,
          delivery.dropoffWindowEnd
        )}`,
        `Status: ${delivery.status}`,
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
        outcome: input.outcome,
        decisionNote: input.decisionNote ?? null,
        requestedByUserId: input.requestedByUserId ?? null,
      },
    });
  }

  async notifyDeliveryExpired(input: {
    deliveryId: string;
    reason: "pickup_window_passed" | "draft_stale_7_days" | "quoted_stale_48_hours";
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            businessName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      this.logger.warn(
        `notifyDeliveryExpired: delivery ${input.deliveryId} not found, skipping`
      );
      return null;
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    if (!toEmail) {
      return null;
    }

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      delivery.customer?.businessName ??
      "Customer";

    const reasonMessages: Record<string, string> = {
      pickup_window_passed:
        "The pickup window for your delivery has passed without a driver being assigned. Your delivery has been automatically expired. You can create a new delivery with an updated schedule at any time.",
      draft_stale_7_days:
        "Your delivery draft has been inactive for over 7 days and has been automatically expired. You can create a new delivery at any time.",
      quoted_stale_48_hours:
        "Your quoted delivery was not listed on the marketplace within 48 hours and has been automatically expired. You can create a new delivery to get a fresh quote.",
    };

    const reasonMessage = reasonMessages[input.reason] ?? "Your delivery has expired.";

    return this.queueAndSend({
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_STATUS_CHANGED,
      templateCode: "delivery-expired",
      toEmail,
      subject: "Your delivery has expired",
      body: [
        `Hi ${displayName},`,
        "",
        reasonMessage,
        "",
        delivery.pickupAddress ? `Pickup: ${delivery.pickupAddress}` : null,
        delivery.dropoffAddress ? `Drop-off: ${delivery.dropoffAddress}` : null,
        delivery.pickupWindowStart
          ? `Pickup window: ${this.formatWindow(
              delivery.pickupWindowStart,
              delivery.pickupWindowEnd
            )}`
          : null,
        "Status: EXPIRED",
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        deliveryId: delivery.id,
        reason: input.reason,
        status: "EXPIRED",
      },
    });
  }

  /**
   * Notify dealer and admin that an ACTIVE delivery has been stale for 24+ hours.
   * Flag-only — no status change. Humans decide what to do.
   */
  async notifyStaleActiveDelivery(input: {
    deliveryId: string;
    hoursStale: number;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        updatedAt: true,
        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            driverId: true,
            driver: {
              select: {
                user: { select: { email: true, fullName: true } },
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            businessName: true,
            user: { select: { email: true, fullName: true } },
          },
        },
      },
    });

    if (!delivery) {
      this.logger.warn(
        `notifyStaleActiveDelivery: delivery ${input.deliveryId} not found, skipping`
      );
      return null;
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      delivery.customer?.businessName ??
      "Customer";

    const driverName =
      delivery.assignments?.[0]?.driver?.user?.fullName ?? "Unknown";

    return this.queueAndSend({
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_STATUS_CHANGED,
      templateCode: "stale-active-delivery",
      toEmail,
      subject: `Action needed: Delivery has been active for ${Math.floor(input.hoursStale)}+ hours`,
      body: [
        `Hi ${displayName},`,
        "",
        `One of your deliveries has been in Active status for over ${Math.floor(input.hoursStale)} hours without being completed. This may indicate an issue with the delivery.`,
        "",
        "You can close the delivery or revert it to Listed from your dashboard.",
        "",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Driver: ${driverName}`,
        `Status: ACTIVE (stale)`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        reason: "stale_active",
        status: "ACTIVE",
        hoursStale: input.hoursStale,
      },
    });
  }

  /**
   * Notify dealer that a BOOKED delivery was reverted to LISTED
   * because the pickup window passed without the driver starting the trip.
   */
  async notifyDeliveryRevertedToListed(input: {
    deliveryId: string;
    reason: "pickup_window_passed";
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            businessName: true,
            user: { select: { email: true, fullName: true } },
          },
        },
      },
    });

    if (!delivery) {
      this.logger.warn(
        `notifyDeliveryRevertedToListed: delivery ${input.deliveryId} not found, skipping`
      );
      return null;
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      delivery.customer?.businessName ??
      "Customer";

    return this.queueAndSend({
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_STATUS_CHANGED,
      templateCode: "delivery-reverted-to-listed",
      toEmail,
      subject: "Delivery reverted: Driver did not start the trip",
      body: [
        `Hi ${displayName},`,
        "",
        "A booked delivery has been automatically reverted to Listed because the driver did not start the trip before the pickup window ended. The delivery is now available for other drivers on the board.",
        "",
        "If you'd like to close this delivery instead, you can do so from your dashboard.",
        "",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        delivery.pickupWindowStart
          ? `Pickup window: ${this.formatWindow(
              delivery.pickupWindowStart,
              delivery.pickupWindowEnd
            )}`
          : null,
        "Status: LISTED",
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        deliveryId: delivery.id,
        reason: input.reason,
        fromStatus: "BOOKED",
        toStatus: "LISTED",
      },
    });
  }

  /**
   * Notify customer that their card has been authorized (funds held).
   * Triggered when Stripe confirms the payment method on a manual-capture PaymentIntent.
   */
  async notifyPaymentAuthorized(input: {
    deliveryId: string;
    amount: number;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            businessName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      this.logger.warn(
        `notifyPaymentAuthorized: delivery ${input.deliveryId} not found, skipping`
      );
      return null;
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    if (!toEmail) {
      return null;
    }

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      delivery.customer?.businessName ??
      "Customer";

    const amountStr = `$${Number(input.amount).toFixed(2)}`;
    const deliveryRef = delivery.id.slice(-6).toUpperCase();

    return this.queueAndSend({
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.PAYMENT_AUTHORIZED,
      templateCode: "payment-authorized",
      toEmail,
      subject: `Payment Confirmed — ${amountStr} held for delivery #${deliveryRef}`,
      body: [
        `Hi ${displayName},`,
        "",
        `Your card has been successfully authorized for ${amountStr}.`,
        "Funds will be held until your delivery is completed, at which point they will be charged.",
        "",
        "No further action is needed from you. The driver can now begin the delivery.",
        "",
        `Delivery: #${deliveryRef}`,
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Amount: ${amountStr}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        amount: input.amount,
        status: delivery.status,
      },
    });
  }

  /**
   * Notify customer that their payment has been captured (card charged).
   * Acts as the payment receipt. Triggered when delivery completes and funds are captured.
   */
  async notifyPaymentCaptured(input: {
    deliveryId: string;
    amount: number;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            businessName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      this.logger.warn(
        `notifyPaymentCaptured: delivery ${input.deliveryId} not found, skipping`
      );
      return null;
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    if (!toEmail) {
      return null;
    }

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      delivery.customer?.businessName ??
      "Customer";

    const amountStr = `$${Number(input.amount).toFixed(2)}`;
    const deliveryRef = delivery.id.slice(-6).toUpperCase();

    return this.queueAndSend({
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.PAYMENT_CAPTURED,
      templateCode: "payment-receipt",
      toEmail,
      subject: `Payment Receipt — ${amountStr} charged for delivery #${deliveryRef}`,
      body: [
        `Hi ${displayName},`,
        "",
        `Your delivery is complete and your card has been charged ${amountStr}.`,
        "",
        "---",
        "Payment Receipt",
        `Delivery: #${deliveryRef}`,
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Amount Charged: ${amountStr}`,
        `Date: ${new Date().toISOString()}`,
        "Status: Completed",
        "---",
        "",
        "Thank you for choosing 101 Drivers! If you have any questions about this charge, please contact support.",
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        amount: input.amount,
        status: delivery.status,
      },
    });
  }

  private async notifyStatusChangeInternal(input: {
    deliveryId: string;
    actorUserId?: string | null;
    type: EnumNotificationEventType;
    templateCode: string;
    subject: string;
    intro: string;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new Error("Delivery not found");
    }

    const toEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    if (!toEmail) {
      return null;
    }

    const displayName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      "Customer";

    return this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: input.type,
      templateCode: input.templateCode,
      toEmail,
      subject: input.subject,
      body: [
        `Hi ${displayName},`,
        "",
        input.intro,
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
      },
    });
  }

  private formatWindow(
    start?: Date | string | null,
    end?: Date | string | null
  ): string {
    if (!start || !end) {
      return "Not set";
    }

    return `${new Date(start).toISOString()} → ${new Date(end).toISOString()}`;
  }

  private wrapSimpleHtml(subject: string, body: string): string {
    const escapedSubject = this.escapeHtml(subject);
    const escapedBody = this.escapeHtml(body).replace(/\n/g, "<br />");

    // Convert URLs (especially tracking links) into clickable <a> tags
    // so they work reliably on mobile email clients
    const withLinks = escapedBody.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color: #2563eb; word-break: break-all;">$1</a>'
    );

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto;">
        <h2>${escapedSubject}</h2>
        <p>${withLinks}</p>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  async notifyDeliveryCancelled(input: {
    deliveryId: string;
    actorUserId?: string | null;
    driverId?: string | null;
    /** True when the trip was started (lock-in captured) before cancel. */
    lockInRetained?: boolean;
    /** The lock-in base fee amount charged (in dollars), if retained. */
    lockInAmount?: number | null;
    /** Driver's share % at the time of lock-in. */
    lockInDriverSharePct?: number | null;
  }) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: {
          select: {
            id: true,
            contactEmail: true,
            contactName: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
        assignments: {
          where: {
            ...(input.driverId ? { driverId: input.driverId } : {}),
          },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            driver: {
              select: {
                id: true,
                phone: true,
                user: {
                  select: {
                    email: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new Error("Delivery not found");
    }

    const lockInRetained = !!input.lockInRetained && !!input.lockInAmount && input.lockInAmount > 0;
    const lockInAmount = Number(input.lockInAmount ?? 0);
    const driverSharePct = Number(input.lockInDriverSharePct ?? 60);
    const driverNet = Number((lockInAmount * driverSharePct / 100).toFixed(2));

    const customerEmail =
      delivery.customer?.user?.email ??
      delivery.customer?.contactEmail ??
      null;

    const customerName =
      delivery.customer?.user?.fullName ??
      delivery.customer?.contactName ??
      "Customer";

    if (customerEmail) {
      const bodyLines = [
        `Hi ${customerName},`,
        "",
        "Your delivery has been cancelled.",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ];

      if (lockInRetained) {
        bodyLines.push(
          "",
          "Important — base fee charged",
          `Because the driver had already started this trip, the non-refundable base fee of $${lockInAmount.toFixed(2)} has been charged to your card. This charge is final and will not be refunded. The driver is compensated for arriving and starting the trip.`,
          "If you believe this is in error, please contact our operations team.",
        );
      }

      await this.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        customerId: delivery.customerId,
        deliveryId: delivery.id,
        driverId: input.driverId ?? null,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DELIVERY_CANCELLED,
        templateCode: lockInRetained
          ? "delivery-cancelled-lock-in-customer"
          : "delivery-cancelled-customer",
        toEmail: customerEmail,
        subject: lockInRetained
          ? `Your delivery has been cancelled — base fee of $${lockInAmount.toFixed(2)} charged`
          : "Your delivery has been cancelled",
        body: bodyLines.join("\n"),
        payload: {
          deliveryId: delivery.id,
          status: delivery.status,
          lockInRetained,
          lockInAmount: lockInRetained ? lockInAmount : null,
        },
      });
    }

    const assignedDriver = delivery.assignments?.[0]?.driver;
    const driverEmail = assignedDriver?.user?.email ?? null;
    const driverName = assignedDriver?.user?.fullName ?? "Driver";

    if (driverEmail) {
      const bodyLines = [
        `Hi ${driverName},`,
        "",
        "The delivery you were assigned to has been cancelled.",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ];

      if (lockInRetained) {
        bodyLines.push(
          "",
          "Good news — your lock-in payout is secured",
          `Because you had already started this trip, the base fee of $${lockInAmount.toFixed(2)} was captured from the customer. Your share (${driverSharePct}% = $${driverNet.toFixed(2)}) is locked in and will be included in your next payout.`,
          "No further action is needed from you for this delivery.",
        );
      }

      await this.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        customerId: delivery.customerId,
        deliveryId: delivery.id,
        driverId: assignedDriver?.id ?? input.driverId ?? null,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DELIVERY_CANCELLED,
        templateCode: lockInRetained
          ? "delivery-cancelled-lock-in-driver"
          : "delivery-cancelled-driver",
        toEmail: driverEmail,
        subject: lockInRetained
          ? `Delivery cancelled — your $${driverNet.toFixed(2)} lock-in payout is secured`
          : "A booked delivery was cancelled",
        body: bodyLines.join("\n"),
        payload: {
          deliveryId: delivery.id,
          status: delivery.status,
          lockInRetained,
          lockInAmount: lockInRetained ? lockInAmount : null,
          driverNet: lockInRetained ? driverNet : null,
        },
      });
    }

    return true;
  }

  async notifyDeliveryAssigned(input: {
  deliveryId: string;
  driverId: string;
  actorUserId?: string | null;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          businessName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
      assignments: {
        where: {
          driverId: input.driverId,
          unassignedAt: null,
        },
        take: 1,
        select: {
          driver: {
            select: {
              id: true,
              phone: true,
              user: {
                select: {
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const assignedDriver = delivery.assignments?.[0]?.driver ?? null;
  const driverEmail = assignedDriver?.user?.email ?? null;
  const driverName = assignedDriver?.user?.fullName ?? "Driver";

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    delivery.customer?.businessName ??
    "Customer";

  if (customerEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      driverId: input.driverId,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_ASSIGNED,
      templateCode: "delivery-assigned-customer",
      toEmail: customerEmail,
      subject: "Your delivery has been assigned",
      body: [
        `Hi ${customerName},`,
        "",
        "A driver has been assigned to your delivery.",
        `Driver: ${driverName}`,
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        driverId: input.driverId,
        status: delivery.status,
      },
    });
  }

  if (driverEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      driverId: input.driverId,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_ASSIGNED,
      templateCode: "delivery-assigned-driver",
      toEmail: driverEmail,
      subject: "You have been assigned a delivery",
      body: [
        `Hi ${driverName},`,
        "",
        "You have been assigned to a delivery.",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        driverId: input.driverId,
        status: delivery.status,
      },
    });
  }

  return true;
}

async notifyDeliveryReassigned(input: {
  deliveryId: string;
  newDriverId: string;
  previousDriverId?: string | null;
  actorUserId?: string | null;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          businessName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
      assignments: {
        orderBy: { assignedAt: "desc" },
        take: 5,
        select: {
          driverId: true,
          unassignedAt: true,
          driver: {
            select: {
              id: true,
              phone: true,
              user: {
                select: {
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    delivery.customer?.businessName ??
    "Customer";

  const newAssignment =
    delivery.assignments?.find(
      (a) => a.driverId === input.newDriverId && !a.unassignedAt
    ) ?? null;

  const previousAssignment =
    input.previousDriverId
      ? delivery.assignments?.find((a) => a.driverId === input.previousDriverId) ?? null
      : null;

  const newDriver = newAssignment?.driver ?? null;
  const previousDriver = previousAssignment?.driver ?? null;

  const newDriverEmail = newDriver?.user?.email ?? null;
  const newDriverName = newDriver?.user?.fullName ?? "Driver";

  const previousDriverEmail = previousDriver?.user?.email ?? null;
  const previousDriverName = previousDriver?.user?.fullName ?? "Driver";

  if (customerEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      driverId: input.newDriverId,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_REASSIGNED,
      templateCode: "delivery-reassigned-customer",
      toEmail: customerEmail,
      subject: "Your delivery driver has been updated",
      body: [
        `Hi ${customerName},`,
        "",
        "Your delivery has been reassigned to a new driver.",
        `New driver: ${newDriverName}`,
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        newDriverId: input.newDriverId,
        previousDriverId: input.previousDriverId ?? null,
        status: delivery.status,
      },
    });
  }

  if (newDriverEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      driverId: input.newDriverId,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_REASSIGNED,
      templateCode: "delivery-reassigned-new-driver",
      toEmail: newDriverEmail,
      subject: "You have been assigned a delivery",
      body: [
        `Hi ${newDriverName},`,
        "",
        "You have been assigned to a delivery.",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        newDriverId: input.newDriverId,
        previousDriverId: input.previousDriverId ?? null,
        status: delivery.status,
      },
    });
  }

  if (previousDriverEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      driverId: input.previousDriverId ?? null,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_REASSIGNED,
      templateCode: "delivery-reassigned-previous-driver",
      toEmail: previousDriverEmail,
      subject: "You have been unassigned from a delivery",
      body: [
        `Hi ${previousDriverName},`,
        "",
        "You have been unassigned from a delivery.",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
      ].join("\n"),
      payload: {
        deliveryId: delivery.id,
        newDriverId: input.newDriverId,
        previousDriverId: input.previousDriverId ?? null,
        status: delivery.status,
      },
    });
  }

  return true;
}

async notifyDeliveryForceCancelled(input: {
  deliveryId: string;
  actorUserId?: string | null;
  driverId?: string | null;
  reason?: string | null;
  /** True when the trip was started (lock-in captured) before force-cancel. */
  lockInRetained?: boolean;
  /** The lock-in base fee amount charged (in dollars), if retained. */
  lockInAmount?: number | null;
  /** Driver's share % at the time of lock-in. */
  lockInDriverSharePct?: number | null;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          businessName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
      assignments: {
        where: {
          ...(input.driverId ? { driverId: input.driverId } : {}),
        },
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          driver: {
            select: {
              id: true,
              user: {
                select: {
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const lockInRetained = !!input.lockInRetained && !!input.lockInAmount && input.lockInAmount > 0;
  const lockInAmount = Number(input.lockInAmount ?? 0);
  const driverSharePct = Number(input.lockInDriverSharePct ?? 60);
  const driverNet = Number((lockInAmount * driverSharePct / 100).toFixed(2));

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    delivery.customer?.businessName ??
    "Customer";

  if (customerEmail) {
    const bodyLines = [
      `Hi ${customerName},`,
      "",
      "Your delivery has been cancelled by Operations/Admin.",
      input.reason ? `Reason: ${input.reason}` : "",
      `Pickup: ${delivery.pickupAddress}`,
      `Drop-off: ${delivery.dropoffAddress}`,
      `Status: ${delivery.status}`,
    ].filter(Boolean);

    if (lockInRetained) {
      bodyLines.push(
        "",
        "Important — base fee charged",
        `Because the driver had already started this trip, the non-refundable base fee of $${lockInAmount.toFixed(2)} has been charged to your card. This charge is final and will not be refunded, even though the delivery was cancelled by our team.`,
        "If you have questions about this charge, please reply to this email or contact our operations team.",
      );
    }

    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      driverId: input.driverId ?? null,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_CANCELLED,
      templateCode: lockInRetained
        ? "delivery-force-cancelled-lock-in-customer"
        : "delivery-force-cancelled-customer",
      toEmail: customerEmail,
      subject: lockInRetained
        ? `Your delivery has been cancelled — base fee of $${lockInAmount.toFixed(2)} charged`
        : "Your delivery has been cancelled",
      body: bodyLines.join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
        reason: input.reason ?? null,
        lockInRetained,
        lockInAmount: lockInRetained ? lockInAmount : null,
      },
    });
  }

  const assignedDriver = delivery.assignments?.[0]?.driver ?? null;
  const driverEmail = assignedDriver?.user?.email ?? null;
  const driverName = assignedDriver?.user?.fullName ?? "Driver";

  if (driverEmail) {
    const bodyLines = [
      `Hi ${driverName},`,
      "",
      "A delivery assigned to you has been cancelled by Operations/Admin.",
      input.reason ? `Reason: ${input.reason}` : "",
      `Pickup: ${delivery.pickupAddress}`,
      `Drop-off: ${delivery.dropoffAddress}`,
      `Status: ${delivery.status}`,
    ].filter(Boolean);

    if (lockInRetained) {
      bodyLines.push(
        "",
        "Good news — your lock-in payout is secured",
        `Because you had already started this trip, the base fee of $${lockInAmount.toFixed(2)} was captured from the customer. Your share (${driverSharePct}% = $${driverNet.toFixed(2)}) is locked in and will be included in your next payout, regardless of the admin cancellation.`,
        "No further action is needed from you for this delivery.",
      );
    }

    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      driverId: assignedDriver?.id ?? input.driverId ?? null,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_CANCELLED,
      templateCode: lockInRetained
        ? "delivery-force-cancelled-lock-in-driver"
        : "delivery-force-cancelled-driver",
      toEmail: driverEmail,
      subject: lockInRetained
        ? `Delivery cancelled by admin — your $${driverNet.toFixed(2)} lock-in payout is secured`
        : "A delivery was cancelled by admin",
      body: bodyLines.join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
        reason: input.reason ?? null,
        lockInRetained,
        lockInAmount: lockInRetained ? lockInAmount : null,
        driverNet: lockInRetained ? driverNet : null,
      },
    });
  }

  return true;
}

async notifyDisputeOpened(input: {
  deliveryId: string;
  actorUserId?: string | null;
  reason: string;
  legalHold?: boolean;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          businessName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
      assignments: {
        where: { unassignedAt: null },
        take: 1,
        select: {
          driver: {
            select: {
              id: true,
              user: {
                select: {
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    delivery.customer?.businessName ??
    "Customer";

  if (customerEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DISPUTE_OPENED,
      templateCode: "dispute-opened-customer",
      toEmail: customerEmail,
      subject: "A dispute has been opened for your delivery",
      body: [
        `Hi ${customerName},`,
        "",
        "A dispute has been opened for your delivery.",
        `Reason: ${input.reason}`,
        input.legalHold === true ? "Legal hold: ON" : "",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
        reason: input.reason,
        legalHold: input.legalHold === true,
      },
    });
  }

  const assignedDriver = delivery.assignments?.[0]?.driver ?? null;
  const driverEmail = assignedDriver?.user?.email ?? null;
  const driverName = assignedDriver?.user?.fullName ?? "Driver";

  if (driverEmail) {
    await this.queueAndSend({
      actorUserId: input.actorUserId ?? null,
      customerId: delivery.customerId,
      deliveryId: delivery.id,
      driverId: assignedDriver?.id ?? null,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DISPUTE_OPENED,
      templateCode: "dispute-opened-driver",
      toEmail: driverEmail,
      subject: "A dispute has been opened for a delivery",
      body: [
        `Hi ${driverName},`,
        "",
        "A dispute has been opened for a delivery associated with you.",
        `Reason: ${input.reason}`,
        input.legalHold === true ? "Legal hold: ON" : "",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        `Status: ${delivery.status}`,
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        deliveryId: delivery.id,
        status: delivery.status,
        reason: input.reason,
        legalHold: input.legalHold === true,
      },
    });
  }

  return true;
}

async notifyLegalHoldUpdated(input: {
  deliveryId: string;
  actorUserId?: string | null;
  legalHold: boolean;
  note?: string | null;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          businessName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    delivery.customer?.businessName ??
    "Customer";

  if (!customerEmail) {
    return null;
  }

  await this.queueAndSend({
    actorUserId: input.actorUserId ?? null,
    customerId: delivery.customerId,
    deliveryId: delivery.id,
    channel: EnumNotificationEventChannel.EMAIL,
    type: EnumNotificationEventType.DISPUTE_UPDATED,
    templateCode: input.legalHold
      ? "legal-hold-enabled"
      : "legal-hold-disabled",
    toEmail: customerEmail,
    subject: input.legalHold
      ? "Legal hold has been placed on your delivery dispute"
      : "Legal hold has been removed from your delivery dispute",
    body: [
      `Hi ${customerName},`,
      "",
      input.legalHold
        ? "A legal hold has been placed on your delivery dispute."
        : "The legal hold on your delivery dispute has been removed.",
      input.note ? `Note: ${input.note}` : "",
      `Pickup: ${delivery.pickupAddress}`,
      `Drop-off: ${delivery.dropoffAddress}`,
      `Status: ${delivery.status}`,
    ]
      .filter(Boolean)
      .join("\n"),
    payload: {
      deliveryId: delivery.id,
      status: delivery.status,
      legalHold: input.legalHold,
      note: input.note ?? null,
    },
  });

  return true;
}

async notifyComplianceApproved(input: {
  deliveryId: string;
  actorUserId?: string | null;
  note?: string | null;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      compliance: {
        select: {
          id: true,
          vinConfirmed: true,
          verifiedByUserId: true,
          verifiedByAdminAt: true,
        },
      },
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          businessName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  if (!customerEmail) {
    return null;
  }

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    delivery.customer?.businessName ??
    "Customer";

  await this.queueAndSend({
    actorUserId: input.actorUserId ?? null,
    customerId: delivery.customerId,
    deliveryId: delivery.id,
    channel: EnumNotificationEventChannel.EMAIL,
    type: EnumNotificationEventType.DELIVERY_STATUS_CHANGED,
    templateCode: "compliance-approved",
    toEmail: customerEmail,
    subject: "Delivery compliance has been approved",
    body: [
      `Hi ${customerName},`,
      "",
      "Your delivery compliance has been reviewed and approved by Operations/Admin.",
      input.note ? `Note: ${input.note}` : "",
      `Pickup: ${delivery.pickupAddress}`,
      `Drop-off: ${delivery.dropoffAddress}`,
      `Status: ${delivery.status}`,
      delivery.compliance?.verifiedByAdminAt
        ? `Approved at: ${delivery.compliance.verifiedByAdminAt.toISOString()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    payload: {
      deliveryId: delivery.id,
      status: delivery.status,
      complianceId: delivery.compliance?.id ?? null,
      verifiedByUserId: delivery.compliance?.verifiedByUserId ?? null,
      verifiedByAdminAt: delivery.compliance?.verifiedByAdminAt ?? null,
      note: input.note ?? null,
    },
  });

  return true;
}
async notifyDealerApproved(input: {
  customerId: string;
  actorUserId?: string | null;
}) {
  const customer = await this.prisma.customer.findUnique({
    where: { id: input.customerId },
    select: {
      id: true,
      approvalStatus: true,
      businessName: true,
      contactName: true,
      contactEmail: true,
      approvedAt: true,
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  const toEmail =
    customer.user?.email ??
    customer.contactEmail ??
    null;

  if (!toEmail) {
    return null;
  }

  const displayName =
    customer.businessName ??
    customer.user?.fullName ??
    customer.contactName ??
    "Customer";

  return this.queueAndSend({
    actorUserId: input.actorUserId ?? null,
    customerId: customer.id,
    channel: EnumNotificationEventChannel.EMAIL,
    type: EnumNotificationEventType.DEALER_APPROVED,
    templateCode: "dealer-approved",
    toEmail,
    subject: "Your dealer account has been approved",
    body: [
      `Hi ${displayName},`,
      "",
      "Your business/dealer account has been approved.",
      "You can now sign in and create delivery requests.",
      customer.approvedAt
        ? `Approved at: ${customer.approvedAt.toISOString()}`
        : "",
      `Approval status: ${customer.approvalStatus}`,
    ]
      .filter(Boolean)
      .join("\n"),
    payload: {
      customerId: customer.id,
      approvalStatus: customer.approvalStatus,
      approvedAt: customer.approvedAt ?? null,
    },
  });
}

async notifyDriverApproved(input: {
  driverId: string;
  actorUserId?: string | null;
}) {
  const driver = await this.prisma.driver.findUnique({
    where: { id: input.driverId },
    select: {
      id: true,
      status: true,
      approvedAt: true,
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  });

  if (!driver) {
    throw new Error("Driver not found");
  }

  const toEmail = driver.user?.email ?? null;

  if (!toEmail) {
    return null;
  }

  const displayName = driver.user?.fullName ?? "Driver";

  return this.queueAndSend({
    actorUserId: input.actorUserId ?? null,
    driverId: driver.id,
    channel: EnumNotificationEventChannel.EMAIL,
    type: EnumNotificationEventType.DRIVER_APPROVED,
    templateCode: "driver-approved",
    toEmail,
    subject: "Your driver account has been approved",
    body: [
      `Hi ${displayName},`,
      "",
      "Your driver account has been approved.",
      "You can now sign in and start receiving delivery opportunities.",
      driver.approvedAt ? `Approved at: ${driver.approvedAt.toISOString()}` : "",
      `Status: ${driver.status}`,
    ]
      .filter(Boolean)
      .join("\n"),
    payload: {
      driverId: driver.id,
      status: driver.status,
      approvedAt: driver.approvedAt ?? null,
    },
  });
}
async notifyTrackingAvailableAfterBooking(input: {
  deliveryId: string;
  trackingUrl: string;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      pickupAddress: true,
      dropoffAddress: true,
      recipientEmail: true,
      recipientName: true,
      customer: {
        select: {
          id: true,
          contactEmail: true,
          contactName: true,
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!delivery) throw new Error("Delivery not found");

  const customerEmail =
    delivery.customer?.user?.email ??
    delivery.customer?.contactEmail ??
    null;

  const customerName =
    delivery.customer?.user?.fullName ??
    delivery.customer?.contactName ??
    "Customer";

  // CUSTOMER EMAIL
  if (customerEmail) {
    await this.queueAndSend({
      deliveryId: delivery.id,
      customerId: delivery.customerId,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_BOOKED,
      templateCode: "tracking-available-customer",
      toEmail: customerEmail,
      subject: "Tracking available for your delivery",
      body: [
        `Hi ${customerName},`,
        "",
        "A driver has been assigned to your delivery.",
        "",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        "",
        `Tracking link: ${input.trackingUrl}`,
      ].join("\n"),
    });
  }

  // RECIPIENT EMAIL
  if (delivery.recipientEmail) {
    await this.queueAndSend({
      deliveryId: delivery.id,
      customerId: delivery.customerId,
      channel: EnumNotificationEventChannel.EMAIL,
      type: EnumNotificationEventType.DELIVERY_BOOKED,
      templateCode: "tracking-available-recipient",
      toEmail: delivery.recipientEmail,
      subject: "Track your vehicle delivery",
      body: [
        `Hi ${delivery.recipientName ?? "Recipient"},`,
        "",
        "Your vehicle delivery is scheduled.",
        "",
        `Pickup: ${delivery.pickupAddress}`,
        `Drop-off: ${delivery.dropoffAddress}`,
        "",
        `Tracking link: ${input.trackingUrl}`,
      ].join("\n"),
    });
  }

  return true;
}

/**
 * Admin-facing self-notification when a lock-in trip is cancelled.
 *
 * This gives the admin who cancelled immediate in-app feedback that:
 *   - The lock-in fee was retained ($X)
 *   - The driver's share was secured ($Y = Z% of $X)
 *   - Both customer and driver were notified via email
 *
 * Without this, the admin only sees customer/driver-facing email subjects
 * in their bell (e.g. "Your delivery has been cancelled — base fee charged")
 * which is confusing because they didn't cancel THEIR OWN delivery.
 *
 * Created with actorUserId = admin's id and toEmail = admin's email, so
 * it shows up in the admin's bell only (not the customer's or driver's).
 */
async notifyAdminLockInRetainedOnCancel(input: {
  deliveryId: string;
  actorUserId: string;
  /** "admin-cancel" for Path B, "admin-force-cancel" for Path C */
  trigger: "admin-cancel" | "admin-force-cancel";
  /** Reason the admin provided (optional for Path B, required for Path C). */
  reason?: string | null;
  driverId?: string | null;
  lockInRetained: boolean;
  lockInAmount: number;
  lockInDriverSharePct?: number | null;
}) {
  // Look up the admin's email so we can address the notification to them.
  const admin = await this.prisma.user.findUnique({
    where: { id: input.actorUserId },
    select: {
      id: true,
      email: true,
      fullName: true,
      username: true,
    },
  });

  if (!admin?.email) {
    this.logger.debug(
      `notifyAdminLockInRetainedOnCancel: admin ${input.actorUserId} has no email, skipping`
    );
    return false;
  }

  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      pickupAddress: true,
      dropoffAddress: true,
      customerId: true,
      customer: {
        select: {
          id: true,
          businessName: true,
          contactName: true,
        },
      },
      assignments: {
        where: input.driverId ? { driverId: input.driverId } : {},
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          driver: {
            select: {
              id: true,
              user: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    this.logger.debug(
      `notifyAdminLockInRetainedOnCancel: delivery ${input.deliveryId} not found, skipping`
    );
    return false;
  }

  const customerLabel =
    delivery.customer?.businessName ??
    delivery.customer?.contactName ??
    "Customer";

  const driverLabel =
    delivery.assignments?.[0]?.driver?.user?.fullName ?? "Driver";

  const lockInAmount = Number(input.lockInAmount ?? 0);
  const driverSharePct = Number(input.lockInDriverSharePct ?? 60);
  const driverNet = Number((lockInAmount * driverSharePct / 100).toFixed(2));

  const actionLabel =
    input.trigger === "admin-force-cancel"
      ? "force-cancelled"
      : "cancelled";

  const subject = input.lockInRetained
    ? `Lock-in retained: delivery ${actionLabel} — $${lockInAmount.toFixed(2)} charged, customer + driver notified`
    : `Delivery ${actionLabel} — no lock-in fee (trip had not started)`;

  const bodyLines = [
    `Hi ${admin.fullName || admin.username || "admin"},`,
    "",
    `You ${actionLabel} delivery ${delivery.id}.`,
    `Pickup: ${delivery.pickupAddress}`,
    `Drop-off: ${delivery.dropoffAddress}`,
    `Customer: ${customerLabel}`,
    `Driver: ${driverLabel}`,
    input.reason ? `Reason: ${input.reason}` : null,
    "",
    input.lockInRetained
      ? "Lock-in outcome"
      : "Payment outcome",
    input.lockInRetained
      ? `Because the driver had already started this trip, the non-refundable base fee of $${lockInAmount.toFixed(2)} was charged to the customer. The driver's share (${driverSharePct}% = $${driverNet.toFixed(2)}) is secured and will be paid in their next payout.`
      : "The trip had not started yet, so no lock-in fee was charged. Any prior authorization hold will be released within 1-2 business days.",
    "",
    "Notifications sent",
    input.lockInRetained
      ? "Customer and driver were both emailed with the lock-in details. Both notifications also appear in their in-app bell."
      : "Customer and driver were both emailed about the cancellation. Both notifications also appear in their in-app bell.",
    "An AdminAuditLog row was written for this action — view it in the Audit Logs page.",
  ].filter((line): line is string => line !== null);

  await this.queueAndSend({
    actorUserId: input.actorUserId,
    customerId: delivery.customerId,
    deliveryId: delivery.id,
    driverId: input.driverId ?? null,
    channel: EnumNotificationEventChannel.EMAIL,
    type: EnumNotificationEventType.DELIVERY_CANCELLED,
    templateCode: input.lockInRetained
      ? "admin-lock-in-retained-confirmation"
      : "admin-cancel-confirmation",
    toEmail: admin.email,
    subject,
    body: bodyLines.join("\n"),
    payload: {
      deliveryId: delivery.id,
      status: delivery.status,
      trigger: input.trigger,
      reason: input.reason ?? null,
      lockInRetained: input.lockInRetained,
      lockInAmount: input.lockInRetained ? lockInAmount : null,
      driverNet: input.lockInRetained ? driverNet : null,
      customerNotified: true,
      driverNotified: true,
    },
  });

  return true;
}
}