/**
 * WeeklyPayoutScheduler — automatic weekly cash-out of every driver's
 * ELIGIBLE balance (the Lyft/DoorDash default payout rhythm).
 *
 * Collects all ELIGIBLE DriverPayout rows per driver (delivery earnings
 * + referral bonuses — both are born-ELIGIBLE now) into a payout batch and
 * transfers it to the driver's Stripe Connect account via the standard
 * (free) rail. Drivers who prefer instant access can still cash out
 * manually anytime (free withdrawal / instant payout in the wallet).
 *
 * Safety:
 *   - Drivers WITHOUT completed Connect onboarding are skipped (their
 *     batch reverts + their money stays in the balance until they finish
 *     "Set Up Payouts").
 *   - Kill switch: set PAYOUT_WEEKLY_CRON_DISABLED=true to turn the cron
 *     off without a deploy.
 *   - The admin can still trigger the same run manually via
 *     POST /driverPayouts/admin/process-weekly-payouts.
 */

import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PaymentPayoutEngine } from "../domain/deliveryRequest/paymentPayout.engine";

@Injectable()
export class WeeklyPayoutScheduler {
  private readonly logger = new Logger(WeeklyPayoutScheduler.name);

  constructor(
    @Optional() @Inject(PaymentPayoutEngine)
    private readonly payoutEngine?: PaymentPayoutEngine,
  ) {}

  /** Every Monday 06:00 (server timezone). */
  @Cron("0 6 * * 1")
  async handleWeeklyAutoPayouts(): Promise<void> {
    if (process.env.PAYOUT_WEEKLY_CRON_DISABLED === "true") {
      this.logger.log("Weekly auto-payouts skipped — PAYOUT_WEEKLY_CRON_DISABLED=true");
      return;
    }
    if (!this.payoutEngine) {
      this.logger.warn("Weekly auto-payouts skipped — PaymentPayoutEngine unavailable");
      return;
    }

    try {
      const result = await this.payoutEngine.processWeeklyAutoPayouts();
      this.logger.log(
        `Weekly auto-payouts: ${result?.processed ?? 0} processed, ${result?.skipped ?? 0} skipped`,
      );
    } catch (err: any) {
      this.logger.error(`Weekly auto-payouts failed: ${err?.message}`, err?.stack);
    }
  }
}
