/**
 * Decoupled interface for issuing referral reward payouts.
 *
 * The referral module uses this interface to create DriverPayout rows
 * for referral rewards WITHOUT depending on the driverPayouts module
 * (or any specific payment provider) directly. The implementation
 * lives in the driverPayouts module and is injected via NestJS DI.
 *
 * This is the "port" in a hexagonal architecture — the referral
 * module doesn't know or care whether payouts go through Stripe,
 * PayPal, or an internal ledger. Swap providers by implementing
 * this interface and binding it in the module graph.
 *
 * Two payout types:
 *   - REFERRAL_REFERRER: paid to the referrer per `referralThreshold`
 *     successful referrals (tiered model). Not linked to a specific
 *     referral row — the `referralId` argument is null.
 *   - REFERRAL_REFERRED: one-shot reward paid to the referred driver
 *     when their referral becomes successful. Linked to the specific
 *     Referral row via `referralId`.
 */

/**
 * Result of creating a referral payout.
 * Returns the new DriverPayout row's ID so the caller can stamp it
 * back onto the Referral row (e.g. `referredPayoutId`).
 */
export interface ReferralPayoutResult {
  payoutId: string;
}

export interface CreateReferrerTierPayoutInput {
  /** The driver who referred someone — gets the tier payout. */
  referrerDriverId: string;
  /** Amount in USD to pay (read live from the config at trigger time). */
  amount: number;
  /** Tier number being paid out (1 = first 20 referrals, 2 = next 20, etc.). */
  tierNumber: number;
}

export interface CreateReferredRewardPayoutInput {
  /** The referred driver — gets the one-shot reward. */
  referredDriverId: string;
  /** Amount in USD to pay (snapshotted from the Referral row). */
  amount: number;
  /** The Referral row this payout is for (so we can link back). */
  referralId: string;
}

/**
 * Port interface — implemented by the driverPayouts (or payment)
 * module. Injected into ReferralTriggerService.
 *
 * Both methods are async and idempotent at the DB level — the
 * implementation should use unique constraints (Referral.referredPayoutId
 * is @unique, and a referrer-tier payout is uniquely identified by
 * driverId + tierNumber via a check in the implementation) to
 * prevent double-payments if a trigger fires twice.
 */
export interface ReferralRewardPayoutProvider {
  /**
   * Create a tier payout for the referrer (type = REFERRAL_REFERRER).
   * The payout is NOT linked to a specific Referral row — it
   * represents the cumulative reward for crossing a tier.
   *
   * Idempotent: if a payout for (referrerDriverId, tierNumber)
   * already exists, returns its ID instead of creating a new one.
   */
  createReferrerTierPayout(
    input: CreateReferrerTierPayoutInput
  ): Promise<ReferralPayoutResult>;

  /**
   * Create a one-shot reward payout for the referred driver
   * (type = REFERRAL_REFERRED). Linked to the specific Referral row.
   *
   * Idempotent: if `referralId` already has a `referredPayoutId`,
   * returns the existing payout ID instead of creating a new one.
   */
  createReferredRewardPayout(
    input: CreateReferredRewardPayoutInput
  ): Promise<ReferralPayoutResult>;
}

/**
 * Injection token for the ReferralRewardPayoutProvider.
 * Use this in `@Inject()` so the binding can be swapped without
 * touching the referral module's code.
 */
export const REFERRAL_REWARD_PAYOUT_PROVIDER =
  Symbol("REFERRAL_REWARD_PAYOUT_PROVIDER");
