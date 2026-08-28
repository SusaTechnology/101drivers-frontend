/**
 * Stripe Error Code → User-Friendly Message + Resolution Mapping
 *
 * This is the SINGLE SOURCE OF TRUTH for how payment failures are
 * communicated to dealers and admins. Both the frontend (dealer
 * dashboard, admin payments page) and the backend (postpaid billing
 * service, notification engine) import from this file.
 *
 * ────────────────────────────────────────────────────────────────
 * DESIGN PRINCIPLES
 * ────────────────────────────────────────────────────────────────
 *
 * 1. Dealers only see what they can fix.
 *    If the error is a bank glitch or processing error, the dealer
 *    sees "we're handling it" — not a scary error they can't act on.
 *
 * 2. Admins see everything.
 *    Every error has a full admin message with the raw Stripe code.
 *
 * 3. Fraud/suspicious errors are admin-only.
 *    The dealer never sees "fraudulent" or "do_not_honor" — these
 *    could tip off bad actors or confuse legitimate dealers.
 *
 * 4. Resolution actions are actionable.
 *    "Update your card" / "Contact your bank" / "We're handling it"
 *    — never just "Error occurred."
 *
 * 5. Retry behavior is communicated.
 *    If Stripe will auto-retry, the dealer knows when. If no retry
 *    is scheduled, the dealer knows they need to act.
 */

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type ResolutionAction =
  | 'update_card'        // Dealer should update their payment method
  | 'contact_bank'       // Dealer should call their bank
  | 'contact_support'   // Dealer should contact 101 Drivers support
  | 'wait_retry'        // No action — Stripe will auto-retry
  | 'admin_review';     // Admin-only — dealer doesn't see this

export interface StripeErrorInfo {
  /** The Stripe decline code / error code (e.g. 'card_declined') */
  code: string;

  /** User-friendly message for the DEALER (or null if admin-only) */
  dealerMessage: string | null;

  /** Detailed message for the ADMIN (always present) */
  adminMessage: string;

  /** What the dealer should do to resolve it */
  resolutionAction: ResolutionAction;

  /** Whether Stripe will auto-retry this error type */
  willAutoRetry: boolean;

  /** Whether this error should trigger account restriction (freeze) */
  shouldRestrict: boolean;

  /** Severity level for UI styling */
  severity: 'info' | 'warning' | 'danger' | 'critical';
}

// ────────────────────────────────────────────────────────────────
// Error Code → Info Mapping
// ────────────────────────────────────────────────────────────────

const ERROR_MAP: Record<string, StripeErrorInfo> = {
  // ── Card errors (dealer can fix by updating card) ──
  card_declined: {
    code: 'card_declined',
    dealerMessage: 'Your card was declined. Please update your payment method to ensure the next charge succeeds.',
    adminMessage: 'Card declined by the issuer. Dealer needs to update their card.',
    resolutionAction: 'update_card',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },
  expired_card: {
    code: 'expired_card',
    dealerMessage: 'Your card has expired. Please update your payment method.',
    adminMessage: 'Card expired. Dealer must update their card.',
    resolutionAction: 'update_card',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },
  incorrect_cvc: {
    code: 'incorrect_cvc',
    dealerMessage: 'The security code on your card is incorrect. Please update your payment method.',
    adminMessage: 'Incorrect CVC. Dealer needs to re-enter card details.',
    resolutionAction: 'update_card',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },
  incorrect_number: {
    code: 'incorrect_number',
    dealerMessage: 'The card number is incorrect. Please update your payment method.',
    adminMessage: 'Incorrect card number. Dealer needs to update their card.',
    resolutionAction: 'update_card',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },
  invalid_number: {
    code: 'invalid_number',
    dealerMessage: 'The card number is invalid. Please update your payment method.',
    adminMessage: 'Invalid card number. Dealer needs to update their card.',
    resolutionAction: 'update_card',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },
  invalid_expiry_month: {
    code: 'invalid_expiry_month',
    dealerMessage: 'The expiration month on your card is invalid. Please update your payment method.',
    adminMessage: 'Invalid expiry month. Dealer needs to update their card.',
    resolutionAction: 'update_card',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },
  invalid_expiry_year: {
    code: 'invalid_expiry_year',
    dealerMessage: 'The expiration year on your card is invalid. Please update your payment method.',
    adminMessage: 'Invalid expiry year. Dealer needs to update their card.',
    resolutionAction: 'update_card',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },
  invalid_cvc: {
    code: 'invalid_cvc',
    dealerMessage: 'The security code on your card is invalid. Please update your payment method.',
    adminMessage: 'Invalid CVC. Dealer needs to update their card.',
    resolutionAction: 'update_card',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },

  // ── Insufficient funds (dealer can fix by adding balance) ──
  insufficient_funds: {
    code: 'insufficient_funds',
    dealerMessage: 'Insufficient funds on your card. Please ensure sufficient balance is available before the next retry date, or use a different card.',
    adminMessage: 'Insufficient funds. Dealer needs to add balance or use a different card.',
    resolutionAction: 'update_card',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },

  // ── Lost/stolen card (dealer must update urgently) ──
  lost_card: {
    code: 'lost_card',
    dealerMessage: 'Your card was reported lost. Please update your payment method immediately.',
    adminMessage: 'Card reported lost. Dealer needs to update immediately.',
    resolutionAction: 'update_card',
    willAutoRetry: false,
    shouldRestrict: false,
    severity: 'danger',
  },
  stolen_card: {
    code: 'stolen_card',
    dealerMessage: 'Your card was reported stolen. Please update your payment method immediately.',
    adminMessage: 'Card reported stolen. Dealer needs to update immediately.',
    resolutionAction: 'update_card',
    willAutoRetry: false,
    shouldRestrict: false,
    severity: 'danger',
  },

  // ── Bank-side errors (dealer should contact bank) ──
  do_not_honor: {
    code: 'do_not_honor',
    dealerMessage: 'Your bank declined the charge. Please contact your bank or try a different card.',
    adminMessage: 'Bank declined (do_not_honor). May indicate account issues — admin should contact dealer.',
    resolutionAction: 'contact_bank',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },
  transaction_not_allowed: {
    code: 'transaction_not_allowed',
    dealerMessage: 'Your bank does not allow this type of transaction. Please contact your bank or try a different card.',
    adminMessage: 'Bank blocked transaction type. Dealer needs to contact bank.',
    resolutionAction: 'contact_bank',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },
  generic_decline: {
    code: 'generic_decline',
    dealerMessage: 'Your card was declined. Please contact your bank or try a different card.',
    adminMessage: 'Generic decline. Dealer should contact bank or update card.',
    resolutionAction: 'contact_bank',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'warning',
  },

  // ── Transient/processing errors (no dealer action needed) ──
  processing_error: {
    code: 'processing_error',
    dealerMessage: 'A temporary processing error occurred. We\'re handling it — no action needed from you. The charge will be retried automatically.',
    adminMessage: 'Processing error (transient). Stripe will auto-retry. Admin can manually retry if needed.',
    resolutionAction: 'wait_retry',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'info',
  },
  offline_decline: {
    code: 'offline_decline',
    dealerMessage: 'A temporary network issue occurred. The charge will be retried automatically — no action needed.',
    adminMessage: 'Offline decline (transient). Stripe will auto-retry.',
    resolutionAction: 'wait_retry',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'info',
  },
  issuer_unavailable: {
    code: 'issuer_unavailable',
    dealerMessage: 'Your bank was temporarily unavailable. The charge will be retried automatically — no action needed.',
    adminMessage: 'Issuer unavailable (transient). Stripe will auto-retry.',
    resolutionAction: 'wait_retry',
    willAutoRetry: true,
    shouldRestrict: false,
    severity: 'info',
  },

  // ── Fraud/suspicious (ADMIN ONLY — dealer never sees these) ──
  fraudulent: {
    code: 'fraudulent',
    dealerMessage: null, // Don't show to dealer
    adminMessage: '⚠️ Stripe flagged potential fraud. REVIEW REQUIRED — do not unfreeze until verified.',
    resolutionAction: 'admin_review',
    willAutoRetry: false,
    shouldRestrict: true, // Immediate freeze
    severity: 'critical',
  },
  security_violation: {
    code: 'security_violation',
    dealerMessage: null,
    adminMessage: '⚠️ Security violation flagged by Stripe. REVIEW REQUIRED.',
    resolutionAction: 'admin_review',
    willAutoRetry: false,
    shouldRestrict: true,
    severity: 'critical',
  },
  service_not_allowed: {
    code: 'service_not_allowed',
    dealerMessage: null,
    adminMessage: 'Card issuer does not allow this service. May indicate a blocked card. REVIEW REQUIRED.',
    resolutionAction: 'admin_review',
    willAutoRetry: false,
    shouldRestrict: true,
    severity: 'critical',
  },

  // ── Account errors (admin resolves) ──
  no_card: {
    code: 'no_card',
    dealerMessage: 'No payment method is on file. Please add a card to your account.',
    adminMessage: 'No card on file. Dealer needs to add a payment method.',
    resolutionAction: 'update_card',
    willAutoRetry: false,
    shouldRestrict: false,
    severity: 'warning',
  },
  card_velocity_exceeded: {
    code: 'card_velocity_exceeded',
    dealerMessage: 'Your card has exceeded its spending limit. Please contact your bank or use a different card.',
    adminMessage: 'Card velocity exceeded. Dealer needs to contact bank or use a different card.',
    resolutionAction: 'contact_bank',
    willAutoRetry: false,
    shouldRestrict: false,
    severity: 'warning',
  },
};

// ────────────────────────────────────────────────────────────────
// Fallback for unknown error codes
// ────────────────────────────────────────────────────────────────

const UNKNOWN_ERROR: StripeErrorInfo = {
  code: 'unknown',
  dealerMessage: 'A payment issue occurred. Please update your payment method or contact support if the issue persists.',
  adminMessage: 'Unknown payment error. Check Stripe dashboard for details.',
  resolutionAction: 'contact_support',
  willAutoRetry: true,
  shouldRestrict: false,
  severity: 'warning',
};

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Look up a Stripe error code and return user-friendly info.
 *
 * @param code The Stripe decline_code or error code
 *   (e.g. 'card_declined', 'insufficient_funds', 'processing_error')
 *   Can be null/undefined — returns the UNKNOWN_ERROR fallback.
 *
 * @returns StripeErrorInfo with dealer + admin messages, resolution
 *   action, retry behavior, and severity.
 */
export function getStripeErrorInfo(code: string | null | undefined): StripeErrorInfo {
  if (!code) return UNKNOWN_ERROR;
  return ERROR_MAP[code] || { ...UNKNOWN_ERROR, code };
}

/**
 * Check if an error code should be shown to the dealer at all.
 * Fraud/security errors return false — admin only.
 */
export function shouldShowDealer(code: string | null | undefined): boolean {
  const info = getStripeErrorInfo(code);
  return info.dealerMessage !== null;
}

/**
 * Check if an error code should trigger an immediate account freeze.
 * Only fraud/security violations freeze immediately — everything else
 * uses the graduated response (warn → restrict after 3+ failures).
 */
export function shouldFreezeImmediately(code: string | null | undefined): boolean {
  const info = getStripeErrorInfo(code);
  return info.shouldRestrict;
}

/**
 * Check if an error is transient (bank glitch, processing error)
 * — no dealer action needed, just retry.
 */
export function isTransientError(code: string | null | undefined): boolean {
  const info = getStripeErrorInfo(code);
  return info.resolutionAction === 'wait_retry';
}

/**
 * Get the dealer-facing button text for the resolution action.
 */
export function getResolutionButtonText(action: ResolutionAction): string {
  switch (action) {
    case 'update_card':
      return 'Update payment method';
    case 'contact_bank':
      return 'Update payment method';
    case 'contact_support':
      return 'Contact support';
    case 'wait_retry':
      return ''; // No button — just wait
    case 'admin_review':
      return ''; // No dealer button — admin handles
    default:
      return '';
  }
}
