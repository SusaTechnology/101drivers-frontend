import type { JobPosting } from "../types";

import { deliveryDriverContractor } from "./delivery-driver-contractor";
import { operationsCoordinator } from "./operations-coordinator";
import { customerSupportSpecialist } from "./customer-support-specialist";

/**
 * Careers registry — the single source of truth for open roles.
 *
 * To add a role: create ./<slug>.ts following the JobPosting shape
 * (see ../types.ts), import it below, and list it in ROLES. The careers
 * index cards and the /careers/$slug detail pages are BOTH generated
 * from this array — no page or route edits, no hard-coded links.
 */
const ROLES: JobPosting[] = [
  deliveryDriverContractor,
  operationsCoordinator,
  customerSupportSpecialist,
];

/** Registry order (no dates on job posts — the owner curates the order). */
export const OPEN_ROLES: JobPosting[] = [...ROLES];

export function getJobPosting(slug: string): JobPosting | undefined {
  return ROLES.find((role) => role.slug === slug);
}
