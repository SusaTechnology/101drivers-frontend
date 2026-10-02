import type { JobPosting } from "../types";

/** Delivery Driver (Independent Contractor) — sample listing. */
export const deliveryDriverContractor: JobPosting = {
  slug: "delivery-driver-contractor",
  title: "Delivery Driver (Independent Contractor)",
  location: "Greater Los Angeles, CA",
  type: "Contractor",
  employmentType: "CONTRACTOR",
  excerpt:
    "Drive different cars across the LA area. Pick your own jobs, see the route and pay before you accept, and get paid weekly.",
  body: [
    "Drive different cars from one location to another across the LA area. Pick your own jobs, see the route and pay before you accept, and get paid weekly. Requires an eligible vehicle, a clean record, and completed in-app onboarding.",
    "Independent contractor driving is not employment — drivers join through the in-app onboarding flow at /driver-signin rather than by applying on this page.",
  ],
  applyEmail: "support@101drivers.com",
};
