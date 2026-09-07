/**
 * ReferralCreditApplicationService — automatic consumption of customer
 * referral credits (the money side of customer referrals).
 *
 * Customers who refer others earn ReferralCredit rows (invoice credits,
 * NOT cash — the same model Uber/Lyft/DoorDash use for customer rewards:
 * it avoids KYC / money-transmitter burden for consumers). Issuing credits
 * is handled by ReferralTriggerService; THIS service consumes them:
 *
 *   1. Postpaid (business) customers:
 *      applyPostpaidCreditsToUpcomingInvoice — called from
 *      PostpaidBillingService.handleInvoiceUpcoming (~1 hour before Stripe
 *      finalizes the weekly invoice). Oldest-first FIFO: whole credits are
 *      applied while the invoice total has room, a NEGATIVE InvoiceItem is
 *      created so Stripe sweeps it into that invoice, and the consumed
 *      credits are marked APPLIED. Invoice upcomings fire weekly, so
 *      credits naturally ride the next weekly invoice.
 *
 *   2. Prepaid (personal) customers:
 *      refundPrepaidCreditForDelivery — called from the delivery
 *      completion flow. The customer's oldest PENDING credit is refunded
 *      to their card as a statement credit (refund against the captured
 *      PaymentIntent). Driver earnings are computed from the original
 *      quote, so a refund NEVER touches driver pay.
 *
 * EVERY method is fail-safe by design: catch-all + log, never throws.
 * A failed application just leaves credits PENDING for the next natural
 * opportunity (next weekly invoice / next completed delivery). Admins can
 * still manually apply/expire PENDING credits from the referral page.
 */

import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../providers/stripe/stripe.service";

export const REFERRAL_CREDIT_APPLICATION_SERVICE =
  Symbol("REFERRAL_CREDIT_APPLICATION_SERVICE");

@Injectable()
export class ReferralCreditApplicationService {
  private readonly logger = new Logger(ReferralCreditApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    // StripeModule is @Global so this resolves in every module context.
    // Optional keeps minimal test/module graphs working.
    @Optional() private readonly stripeService?: StripeService,
  ) {}

  // ── Path 1: postpaid (business) customers — ride the weekly invoice ──

  /**
   * Apply the dealer's PENDING referral credits to the upcoming weekly
   * invoice. Called from handleInvoiceUpcoming.
   *
   * @param dealerId Customer row id (the dealer)
   * @param stripeCustomerId The dealer's Stripe customer id
   * @param invoiceTotalCents Total of the upcoming invoice — the applied
   *        credit never exceeds it (avoids negative invoice totals). Pass
   *        null to apply everything (no cap).
   */
  async applyPostpaidCreditsToUpcomingInvoice(input: {
    dealerId: string;
    stripeCustomerId: string;
    invoiceTotalCents?: number | null;
  }): Promise<void> {
    try {
      if (!this.stripeService) {
        this.logger.warn(
          "Referral credit auto-apply skipped — StripeService unavailable",
        );
        return;
      }

      // Oldest-first FIFO
      const pendingCredits = await this.prisma.referralCredit.findMany({
        where: { customerId: input.dealerId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { id: true, amountCents: true, reason: true },
      });
      if (pendingCredits.length === 0) return;

      // Whole-credit FIFO within the invoice-total budget
      const budgetCents =
        input.invoiceTotalCents && input.invoiceTotalCents > 0
          ? input.invoiceTotalCents
          : Number.MAX_SAFE_INTEGER;
      const applied: typeof pendingCredits = [];
      let appliedCents = 0;
      for (const credit of pendingCredits) {
        if (appliedCents + credit.amountCents > budgetCents) continue;
        applied.push(credit);
        appliedCents += credit.amountCents;
      }
      if (applied.length === 0) {
        this.logger.log(
          `Referral credits for dealer ${input.dealerId} exceed the upcoming invoice total (${budgetCents}c) — left PENDING for the next invoice`,
        );
        return;
      }

      // Negative InvoiceItem — Stripe sweeps it into the finalizing invoice
      await this.stripeService.stripe.invoiceItems.create({
        customer: input.stripeCustomerId,
        amount: -appliedCents,
        currency: "usd",
        description: `Referral rewards credit (${applied.length} credit${applied.length === 1 ? "" : "s"})`,
        metadata: {
          source: "referral-credit-autoapply",
          dealerId: input.dealerId,
          creditIds: applied.map((c) => c.id).join(","),
        },
      });

      // Mark the consumed credits APPLIED (per-row update so each keeps its
      // own reason with an audit suffix).
      const now = new Date();
      for (const c of applied) {
        await this.prisma.referralCredit.update({
          where: { id: c.id },
          data: {
            status: "APPLIED",
            appliedAt: now,
            reason: `${c.reason} [auto-applied to weekly invoice]`,
          },
        });
      }

      this.logger.log(
        `Auto-applied ${applied.length} referral credit(s) (${appliedCents}c) to dealer ${input.dealerId}'s weekly invoice via negative InvoiceItem`,
      );
    } catch (err: any) {
      this.logger.error(
        `applyPostpaidCreditsToUpcomingInvoice failed for dealer ${input.dealerId} (credits stay PENDING): ${err?.message}`,
        err?.stack,
      );
    }
  }

  // ── Path 2: prepaid (personal) customers — statement credit per delivery ──

  /**
   * Refund the customer's oldest PENDING referral credit to their card as a
   * statement credit after a PREPAID delivery completes and the money is
   * captured. Called from the delivery completion flow (non-blocking).
   *
   * One credit per completed delivery — customers with several credits get
   * them back across their next deliveries. If the refund fails, the credit
   * stays PENDING and the next completed delivery retries naturally.
   */
  async refundPrepaidCreditForDelivery(input: {
    deliveryId: string;
    customerId: string;
  }): Promise<void> {
    try {
      if (!this.stripeService) {
        this.logger.warn(
          "Referral credit refund skipped — StripeService unavailable",
        );
        return;
      }

      // The delivery's payment must be PREPAID + CAPTURED (money actually taken)
      const payment = await this.prisma.payment.findFirst({
        where: {
          deliveryId: input.deliveryId,
          paymentType: "PREPAID",
          status: "CAPTURED",
          providerPaymentIntentId: { not: null },
        },
        select: { id: true, providerPaymentIntentId: true },
      });
      if (!payment) {
        // Not prepaid / not captured yet / no PI — nothing to refund against.
        return;
      }

      // Oldest PENDING credit for this customer
      const credit = await this.prisma.referralCredit.findFirst({
        where: { customerId: input.customerId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { id: true, amountCents: true, reason: true },
      });
      if (!credit) return;

      // Statement credit: refund against the captured PaymentIntent
      await this.stripeService.stripe.refunds.create(
        {
          payment_intent: payment.providerPaymentIntentId!,
          amount: credit.amountCents,
          metadata: {
            source: "referral-credit-autoapply",
            deliveryId: input.deliveryId,
            creditId: credit.id,
          },
        } as any,
        { idempotencyKey: `referral-credit-${credit.id}` },
      );

      await this.prisma.referralCredit.update({
        where: { id: credit.id },
        data: {
          status: "APPLIED",
          appliedAt: new Date(),
          reason: `${credit.reason} [auto-refunded to card, delivery ${input.deliveryId}]`,
        },
      });

      this.logger.log(
        `Refunded referral credit ${credit.id} (${credit.amountCents}c) to customer ${input.customerId}'s card as statement credit for delivery ${input.deliveryId}`,
      );
    } catch (err: any) {
      this.logger.error(
        `refundPrepaidCreditForDelivery failed for delivery ${input.deliveryId} (credit stays PENDING): ${err?.message}`,
        err?.stack,
      );
    }
  }
}
