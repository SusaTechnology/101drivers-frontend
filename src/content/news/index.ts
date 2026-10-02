import type { NewsPost } from "../types";

import { sameDayDeliveryLosAngeles } from "./same-day-delivery-los-angeles";
import { richerProofOfDeliveryReports } from "./richer-proof-of-delivery-reports";
import { inAppDriverOnboarding } from "./in-app-driver-onboarding";

/**
 * News registry — the single source of truth for the news section.
 *
 * To add an announcement: create ./<slug>.ts following the NewsPost
 * shape (see ../types.ts), import it below, and list it in POSTS. The
 * news index cards and the /news/$slug detail pages are BOTH generated
 * from this array — no page or route edits, no hard-coded links.
 */
const POSTS: NewsPost[] = [
  sameDayDeliveryLosAngeles,
  richerProofOfDeliveryReports,
  inAppDriverOnboarding,
];

/** Newest first (sorted copy — the registry itself is never mutated). */
export const NEWS_POSTS: NewsPost[] = [...POSTS].sort((a, b) =>
  b.date.localeCompare(a.date),
);

export function getNewsPost(slug: string): NewsPost | undefined {
  return POSTS.find((post) => post.slug === slug);
}
