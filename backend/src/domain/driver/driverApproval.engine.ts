import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumDriverStatus,
  EnumNotificationEventChannel,
  EnumNotificationEventStatus,
  EnumNotificationEventType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";
import { MailService } from "../../common/mail/mail.service";
import { ReferralTriggerService } from "../../referral/referral-trigger.service";
import { randomBytes } from "crypto";

@Injectable()
export class DriverApprovalEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationEventEngine: NotificationEventEngine,
    // forwardRef avoids a circular module dependency:
    //   DriverModule → DriverApprovalEngine → ReferralTriggerService
    //   → ReferralModule → DriverPayoutModule → DeliveryLogisticsModule → ...
    //   → DriverModule (if it ever reaches back here)
    // The referral trigger is fire-and-forget — if it fails, the cron
    // will pick up the slack. We never rethrow into the approval flow.
    @Inject(forwardRef(() => ReferralTriggerService))
    private readonly referralTrigger: ReferralTriggerService,
  ) {}

  /**
   * INVITE: Admin invites a waitlisted driver to complete the full application.
   * WAITLISTED → INVITED
   * Generates onboarding token and sends invitation email.
   */
  async inviteDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        userId: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status !== EnumDriverStatus.WAITLISTED) {
      throw new BadRequestException("Only waitlisted drivers can be invited");
    }

    const beforeJson = driver;

    // Generate a unique onboarding token for the driver
    const onboardingToken = randomBytes(32).toString("hex");

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.INVITED,
        onboardingToken,
        // The admin-invite date, shown on the admin user detail page.
        // inviteDriver only runs from WAITLISTED (the guard above), so
        // this stamps the FIRST invite; resendInviteDriver rotates the
        // token without touching it. Never overwritten afterwards.
        invitedAt: new Date(),
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.OTHER,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });

    const toEmail = driver.user?.email?.trim().toLowerCase() || null;
    const displayName = driver.user?.fullName || "Driver";

    if (toEmail) {
      await this.notificationEventEngine.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        driverId: input.driverId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DRIVER_APPROVED,
        templateCode: "driver-invited",
        subject: "You\u2019re invited to complete your driver application \u2014 101 Drivers",
        // ── Previous invite copy (commented out — ops may want it back) ──
        // body: [
        //   `Hi ${displayName},`,
        //   "",
        //   "Good news! You\u2019ve been selected to move forward with your driver application.",
        //   "Please complete your application by visiting the link below:",
        //   "",
        //   `https://${(process.env.APP_DOMAIN || "101drivers.com").replace(/^https?:\/\//, "")}/driver-onboarding-complete?token=${onboardingToken}`,
        //   "",
        //   "You will need to provide the following:",
        //   "",
        //   "\u2022  Driver\u2019s license (front and back photos)",
        //   "\u2022  Social Security Number",
        //   "\u2022  Current residential address",
        //   "\u2022  Selfie photo for identity verification",
        //   "",
        //   "Once we receive your complete application, we\u2019ll review it and get back to you.",
        //   input.note ? `\nNote from our team: ${input.note}` : "",
        // ]
        //   .filter(Boolean)
        //   .join("\n"),
        body: [
          `Hi ${displayName},`,
          "",
          "good news \u2014 you\u2019ve been selected to move forward with your 101 Drivers application.",
          "",
          `Complete it here: https://${(process.env.APP_DOMAIN || "101drivers.com").replace(/^https?:\/\//, "")}/driver-onboarding-complete?token=${onboardingToken}. You\u2019ll need your driver\u2019s license front and back, photos, Social Security number, current address, and a selfie for ID verification.`,
          "",
          "Once we receive everything, your application goes into review. A team member may follow up by email or phone with a quick two-to-three-minute call before we run the final background check. It only takes a few minutes and helps us get you approved faster.",
          "",
          "Thanks, 101 Drivers.",
          input.note ? `\nNote from our team: ${input.note}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        toEmail,
        payload: {
          driverId: input.driverId,
          invitedAt: afterDriver ? new Date().toISOString() : null,
          note: input.note ?? null,
        },
      });
    }
  }

  /**
   * APPROVE: Admin approves a driver who submitted their full application.
   * PENDING_APPROVAL → APPROVED
   */
  async approveDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        approvedAt: true,
        approvedByUserId: true,
        userId: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status === EnumDriverStatus.APPROVED) {
      throw new BadRequestException("Driver is already approved");
    }

    if (
      driver.status !== EnumDriverStatus.PENDING_APPROVAL &&
      driver.status !== EnumDriverStatus.MEETING_REQUESTED &&
      driver.status !== EnumDriverStatus.REJECTED
    ) {
      throw new BadRequestException("Only drivers with pending approval, meeting requested, or rejected can be approved");
    }

    const beforeJson = driver;

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: input.actorUserId
          ? { connect: { id: input.actorUserId } }
          : undefined,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        approvedAt: true,
        approvedByUserId: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DRIVER_APPROVE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });

    const toEmail = driver.user?.email?.trim().toLowerCase() || null;
    const displayName = driver.user?.fullName || "Driver";

    if (toEmail) {
      await this.notificationEventEngine.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        driverId: input.driverId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DRIVER_APPROVED,
        templateCode: "driver-approved",
        subject: "Your driver application has been approved \u2014 101 Drivers",
        body: [
          `Hi ${displayName},`,
          "",
          "Great news! Your driver application has been approved.",
          "You now have access to the 101 Drivers platform.",
          "Log in to your account to start viewing available deliveries:",
          "",
          `https://${(process.env.APP_DOMAIN || "101drivers.com").replace(/^https?:\/\//, "")}/driver-signin`,
          "",
          input.note ? `Note from our team: ${input.note}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        toEmail,
        payload: {
          driverId: input.driverId,
          approvedAt: afterDriver?.approvedAt ?? null,
          note: input.note ?? null,
        },
      });
    }

    // ── Fire the referral trigger (if this driver was referred) ──
    // Decoupled one-line call: the referral trigger service decides
    // internally whether to fire a payout (based on the snapshotted
    // policy on the referred driver's Referral row + the live
    // program config). If the program is paused, the trigger is a
    // no-op. If it fails for any reason, the cron picks up the slack.
    // We don't await — keep the approval flow fast.
    //
    // isFirstApproval computation: the `driver` object was fetched
    // BEFORE the status update above, so `driver.approvedAt` reflects
    // the OLD value. If it's null, this is the FIRST approval transition
    // (PENDING_APPROVAL/REJECTED → APPROVED). If it's a Date, this is
    // a re-approval (e.g. SUSPENDED → APPROVED) and the referral
    // trigger must NOT fire again (would be a duplicate payout).
    //
    // The approveDriver method accepts both PENDING_APPROVAL and
    // REJECTED as source states (see guard at line 162-167). For both
    // of those, approvedAt would be null on a truly first approval.
    // (REJECTED → APPROVED happens when a driver was previously
    // rejected without ever being approved; their approvedAt stays null.)
    // SUSPENDED drivers have approvedAt set (they were approved before
    // being suspended), so their re-approval correctly passes
    // isFirstApproval=false.
    const isFirstApproval = !driver.approvedAt;
    void this.referralTrigger.onDriverApproved(input.driverId, isFirstApproval).catch((err) => {
      // Swallow — don't break the approval flow on referral trigger failure
      console.error("[DriverApprovalEngine] referral trigger failed:", err);
    });
  }

  /**
   * REQUEST MEETING: Admin emails a pending-approval driver to schedule
   * their onboarding meeting.
   * PENDING_APPROVAL → MEETING_REQUESTED
   *
   * ATOMICITY CONTRACT (the whole point of this method): the status flip,
   * the audit row, the driver-facing NotificationEvent row, and the SMTP
   * send all happen inside ONE interactive transaction, with the email
   * send LAST so every statement that could realistically fail fails
   * BEFORE the email leaves. If the send throws (bad credentials, SMTP
   * outage, slow server), the whole transaction rolls back — the driver
   * stays PENDING_APPROVAL, no audit row, no bell row, and the admin sees
   * the exact error and can retry. There is never a committed state where
   * the status says "not contacted" but the email went out, or the other
   * way around (the only theoretical window is a commit failure after a
   * successful send — same residual risk as Stripe-style "webhook after
   * commit" designs; unavoidable with an external side effect).
   *
   * This deliberately does NOT reuse NotificationEventEngine.queueAndSend:
   * that path is fire-and-forget (the send happens after the HTTP response)
   * and cannot roll the status change back on email failure.
   */
  async requestMeetingDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    message: string;
  }): Promise<void> {
    const message = (input.message ?? "").trim();
    if (!message) {
      throw new BadRequestException("A meeting request message is required");
    }

    // Fail fast BEFORE opening the transaction when SMTP is not configured
    // — an otherwise-guaranteed rollback with a clearer, actionable error.
    if (!this.mailService.isConfigured) {
      throw new BadRequestException(
        "Email sending is not configured on the server (SMTP). Cannot send a meeting request."
      );
    }

    // Pre-read for a friendly 404 + email presence + the before/after
    // audit snapshot. The AUTHORITATIVE status guard is the updateMany
    // inside the transaction below (atomic — a concurrent approve/reject
    // that commits first makes it match zero rows instead of double-sending).
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        userId: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status !== EnumDriverStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        "Only drivers with pending approval can be requested for a meeting"
      );
    }

    const toEmail = driver.user?.email?.trim().toLowerCase() || null;
    if (!toEmail) {
      throw new BadRequestException(
        "This driver has no email address on file — a meeting request email cannot be sent"
      );
    }

    const displayName = driver.user?.fullName || "Driver";
    const subject = "Let's schedule your 101 Drivers onboarding meeting";
    const text = [
      `Hi ${displayName},`,
      "",
      message,
      "",
      "Thanks,",
      "101 Drivers",
    ].join("\n");
    const html = this.wrapMeetingEmailHtml(displayName, message);

    // The interactive transaction carries an SMTP round-trip (bounded by
    // MailService's 15s/30s socket timeouts), so the default 5s transaction
    // timeout must be raised — otherwise Prisma would abort the tx mid-send
    // and roll back while the email was still in flight.
    await this.prisma.$transaction(
      async (tx) => {
        // 1. ATOMIC status guard: only flips when the row is still
        //    PENDING_APPROVAL at commit time. count=0 → someone approved /
        //    rejected / already requested concurrently → abort with zero
        //    side effects (no duplicate email).
        const updated = await tx.driver.updateMany({
          where: {
            id: input.driverId,
            status: EnumDriverStatus.PENDING_APPROVAL,
          },
          data: { status: EnumDriverStatus.MEETING_REQUESTED },
        });

        if (updated.count === 0) {
          throw new BadRequestException(
            "Driver is no longer pending approval — refresh and try again"
          );
        }

        // 2. Audit trail — who requested the meeting, when, the exact
        //    message that went out, and the before/after status.
        await tx.adminAuditLog.create({
          data: {
            action: EnumAdminAuditLogAction.DRIVER_MEETING_REQUEST,
            actorUserId: input.actorUserId ?? null,
            actorType: EnumAdminAuditLogActorType.USER,
            driverId: input.driverId,
            reason: message,
            beforeJson: { status: driver.status } as Prisma.JsonObject,
            afterJson: {
              status: EnumDriverStatus.MEETING_REQUESTED,
            } as Prisma.JsonObject,
          },
        });

        // 3. Driver-facing NotificationEvent row (driver inbox / bell data
        //    source). Created with status SENT + sentAt because the send
        //    below happens before commit — if it throws, this row never
        //    materializes.
        await tx.notificationEvent.create({
          data: {
            actorUserId: input.actorUserId ?? null,
            driverId: input.driverId,
            toUserId: driver.userId,
            channel: EnumNotificationEventChannel.EMAIL,
            type: EnumNotificationEventType.REMINDER,
            status: EnumNotificationEventStatus.SENT,
            sentAt: new Date(),
            subject,
            body: text,
            templateCode: "driver-meeting-request",
            toEmail,
            payload: {
              driverId: input.driverId,
              message,
            },
          },
        });

        // 4. THE SEND — deliberately last. Any throw above already
        //    aborted; any throw here rolls 1–3 back together.
        await this.mailService.sendMail({
          to: toEmail,
          subject,
          text,
          html,
        });
      },
      { maxWait: 10_000, timeout: 60_000 }
    );
  }

  /** Plain-text meeting email → simple branded HTML (same style the
   *  NotificationEventEngine uses for its generic emails). */
  private wrapMeetingEmailHtml(displayName: string, message: string): string {
    const escape = (value: string): string =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const escapedMessage = escape(message)
      .replace(/\n/g, "<br />")
      .replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" style="color: #2563eb; word-break: break-all;">$1</a>'
      );

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto;">
        <h2>Let's schedule your onboarding meeting</h2>
        <p>Hi ${escape(displayName)},</p>
        <p>${escapedMessage}</p>
        <p>Thanks,<br />101 Drivers</p>
      </div>
    `;
  }

  /**
   * SUSPEND: Admin suspends an approved driver.
   * APPROVED → SUSPENDED
   */
  async suspendDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    reason: string;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status === EnumDriverStatus.SUSPENDED) {
      throw new BadRequestException("Driver is already suspended");
    }

    const beforeJson = driver;

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.SUSPENDED,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DRIVER_SUSPEND,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.reason,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * UNSUSPEND: Admin unsuspends a suspended driver back to approved.
   * SUSPENDED → APPROVED
   */
  async unsuspendDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const beforeJson = driver;

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.APPROVED,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DRIVER_UNSUSPEND,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * HOLD: Admin parks a pre-activation applicant without rejecting them.
   * WAITLISTED / INVITED / PENDING_APPROVAL → ON_HOLD
   *
   * Business context: 101 Drivers signs drivers up region by region. When
   * a region has enough drivers (or has not launched yet), applicants are
   * put ON HOLD instead of rejected — the record stays in the system and
   * can be revisited later (release → back to the previous funnel stage,
   * or reject if a later review finds the application fake).
   *
   * Silent by design: no email/notification is sent to the applicant —
   * hold is an internal pipeline state, unlike invite/approve/reject
   * which communicate a decision. The pre-hold stage is stored on the
   * Driver row (heldFromStatus / heldAt) so release restores exactly
   * where they were; the full who/when/why trail lives in AdminAuditLog
   * (DRIVER_HOLD action).
   */
  async holdDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    reason?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        heldFromStatus: true,
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status === EnumDriverStatus.ON_HOLD) {
      throw new BadRequestException("Driver is already on hold");
    }

    if (driver.status === EnumDriverStatus.APPROVED) {
      throw new BadRequestException(
        "Approved drivers cannot be put on hold — use suspend instead"
      );
    }

    if (driver.status === EnumDriverStatus.SUSPENDED) {
      throw new BadRequestException("Suspended driver cannot be put on hold");
    }

    if (driver.status === EnumDriverStatus.REJECTED) {
      throw new BadRequestException("Rejected driver cannot be put on hold");
    }

    const beforeJson = driver;

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.ON_HOLD,
        heldFromStatus: driver.status,
        heldAt: new Date(),
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        heldFromStatus: true,
        heldAt: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DRIVER_HOLD,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.reason ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * RELEASE HOLD: Admin moves a held driver back to the funnel stage they
   * were in when the hold was placed.
   * ON_HOLD → heldFromStatus (falls back to WAITLISTED for legacy rows
   * that were held before the column existed). Clears the hold fields and
   * writes a DRIVER_RELEASE audit row. Silent by design — no email.
   */
  async releaseDriverHold(input: {
    driverId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        heldFromStatus: true,
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status !== EnumDriverStatus.ON_HOLD) {
      throw new BadRequestException("Driver is not on hold");
    }

    const restoreStatus = driver.heldFromStatus ?? EnumDriverStatus.WAITLISTED;

    const beforeJson = driver;

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: restoreStatus,
        heldFromStatus: null,
        heldAt: null,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        heldFromStatus: true,
        heldAt: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DRIVER_RELEASE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * REJECT: Admin rejects a driver application.
   * WAITLISTED / INVITED / PENDING_APPROVAL / ON_HOLD → REJECTED
   * (sets status instead of deleting)
   */
  async rejectDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    reason?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        approvedAt: true,
        approvedByUserId: true,
        userId: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status === EnumDriverStatus.APPROVED) {
      throw new BadRequestException("Approved driver cannot be rejected");
    }

    if (driver.status === EnumDriverStatus.SUSPENDED) {
      throw new BadRequestException("Suspended driver cannot be rejected");
    }

    if (driver.status === EnumDriverStatus.REJECTED) {
      throw new BadRequestException("Driver is already rejected");
    }

    if (
      driver.status !== EnumDriverStatus.WAITLISTED &&
      driver.status !== EnumDriverStatus.INVITED &&
      driver.status !== EnumDriverStatus.PENDING_APPROVAL &&
      driver.status !== EnumDriverStatus.MEETING_REQUESTED &&
      driver.status !== EnumDriverStatus.ON_HOLD
    ) {
      throw new BadRequestException("Driver cannot be rejected in current status");
    }

    const beforeJson = driver;

    // Set status to REJECTED instead of deleting
    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.REJECTED,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.OTHER,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.reason ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });

    // NO EMAIL on rejection (owner decision): rejection is a silent admin
    // state change. Unlike invite/approve (which email instructions), a
    // rejected applicant gets no notification — the admin reviews the
    // application (usually a second-round fake-document find) and may
    // revisit the record later via approve.
  }

  /**
   * RESEND INVITE: Admin resends invitation to an already-invited driver.
   * INVITED → INVITED (regenerates onboarding token, resends email)
   */
  async resendInviteDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        userId: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status !== EnumDriverStatus.INVITED) {
      throw new BadRequestException("Only invited drivers can have their invite resent");
    }

    const beforeJson = driver;

    // Generate a new onboarding token
    const onboardingToken = randomBytes(32).toString("hex");

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        onboardingToken,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.OTHER,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });

    const toEmail = driver.user?.email?.trim().toLowerCase() || null;
    const displayName = driver.user?.fullName || "Driver";

    if (toEmail) {
      await this.notificationEventEngine.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        driverId: input.driverId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DRIVER_APPROVED,
        templateCode: "driver-invited",
        subject: "Reminder: Complete your driver application \u2014 101 Drivers",
        body: [
          `Hi ${displayName},`,
          "",
          "This is a reminder to complete your driver application with 101 Drivers.",
          "Please visit the link below to finish your onboarding:",
          "",
          `https://${(process.env.APP_DOMAIN || "101drivers.techbee.et").replace(/^https?:\/\//, "")}/driver-onboarding-complete?token=${onboardingToken}`,
          "",
          "You will need to provide the following:",
          "",
          "\u2022  Driver\u2019s license (front and back photos)",
          "\u2022  Social Security Number",
          "\u2022  Current residential address",
          "\u2022  Selfie photo for identity verification",
          "",
          "Once we receive your complete application, we\u2019ll review it and get back to you.",
          input.note ? `\nNote from our team: ${input.note}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        toEmail,
        payload: {
          driverId: input.driverId,
          invitedAt: afterDriver ? new Date().toISOString() : null,
          note: input.note ?? null,
        },
      });
    }
  }
}
