import type { BlogPost } from "../types";

import { flatRatePricing } from "./flat-rate-pricing";
import { keyHandoverChecklist } from "./key-handover-checklist";
import { pickupToDropoff } from "./pickup-to-dropoff";
import { bestCarDeliveryServiceCalifornia } from "./best-car-delivery-service-california";
import { carDeliveryVsDrivingYourself } from "./car-delivery-vs-driving-yourself";
import { dealershipVehicleTransportGuide } from "./dealership-vehicle-transport-guide";
import { howMuchDoesVehicleTransportCostCalifornia } from "./how-much-does-vehicle-transport-cost-california";
import { transportCarLosAngelesToSanDiego } from "./transport-car-los-angeles-to-san-diego";

/**
 * Blog registry — the single source of truth for the blog section.
 *
 * To add a post: create ./<slug>.ts following the BlogPost shape
 * (see ../types.ts), import it below, and list it in POSTS. The blog
 * index cards and the /blog/$slug detail pages are BOTH generated from
 * this array — no page or route edits, no hard-coded links.
 */
const POSTS: BlogPost[] = [
  // Owner-authored articles (extracted verbatim from the hand-built
  // route pages they replaced — routes are generated from this registry).
  bestCarDeliveryServiceCalifornia,
  carDeliveryVsDrivingYourself,
  dealershipVehicleTransportGuide,
  howMuchDoesVehicleTransportCostCalifornia,
  transportCarLosAngelesToSanDiego,
  // Sample posts.
  flatRatePricing,
  keyHandoverChecklist,
  pickupToDropoff,
];

/** Newest first (sorted copy — the registry itself is never mutated). */
export const BLOG_POSTS: BlogPost[] = [...POSTS].sort((a, b) =>
  b.date.localeCompare(a.date),
);

export function getBlogPost(slug: string): BlogPost | undefined {
  return POSTS.find((post) => post.slug === slug);
}
