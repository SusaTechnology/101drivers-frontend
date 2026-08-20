/**
 * One-time seed script for the Customer Agreement content.
 *
 * Writes a structured PLACEHOLDER for the Customer Agreement to the
 * AppSetting table (key = CONTENT_CUSTOMER-AGREEMENT). The placeholder
 * shows up immediately in the WYSIWYG editor at /admin/content →
 * "Customer Agreement" tab, so an admin can refine it instead of
 * starting from a blank page.
 *
 * This script does NOT touch any other content (agreement / terms /
 * privacy / FAQs). Those have their own seed scripts.
 *
 * Usage (from the backend/ directory):
 *   npx ts-node scripts/seed-content/seed-customer-agreement.ts
 *
 * Or with tsx (faster):
 *   npx tsx scripts/seed-content/seed-customer-agreement.ts
 *
 * Re-running is safe — it uses upsert, so existing content will be
 * OVERWRITTEN with the placeholder below. Only run this if you want
 * to reset the Customer Agreement back to the placeholder.
 *
 * To RUNTIME-WARN before overwriting published content, set the env
 * variable SKIP_OVERWRITE=1 — the script will then skip the upsert
 * if real content already exists for that key.
 */

import { PrismaClient } from "@prisma/client";

// schema.prisma reads env("DB_URL"), but some deployments only set
// DATABASE_URL. Fall back so this script runs in either environment.
if (!process.env.DB_URL && process.env.DATABASE_URL) {
  process.env.DB_URL = process.env.DATABASE_URL;
}

const prisma = new PrismaClient();

const DB_KEY = "CONTENT_CUSTOMER-AGREEMENT";

// ── Placeholder Customer Agreement HTML ──
// Mirrors the structure of the existing Independent Driver Agreement
// (admin-content.tsx → AGREEMENT_HTML) but reworded for the dealer /
// customer side of the marketplace. Admins should refine the wording
// with their legal counsel before relying on it.
const CUSTOMER_AGREEMENT_HTML = `<h2>Customer Agreement</h2>
<p><em>Effective date: To be set by administrator.</em></p>
<p>This Customer Agreement ("Agreement") is entered into by and between the customer or dealer ("Customer") and 101 Drivers, Inc. ("Company"). By checking the agreement box during signup, the Customer acknowledges that they have read, understood, and agree to be bound by the following terms and conditions.</p>

<h3>1. Definitions</h3>
<p>"Platform" means the 101 Drivers web and mobile applications. "Delivery Request" means a request submitted by the Customer to have a vehicle transported from a pickup location to a drop-off location. "Driver" means an independent contractor engaged through the Platform to perform a Delivery Request. "Quote" means the estimated price shown to the Customer prior to submitting a Delivery Request.</p>

<h3>2. Customer Account &amp; Eligibility</h3>
<p>The Customer represents that all information provided during signup is accurate and complete. The Customer is responsible for maintaining the confidentiality of their account credentials and for all activity that occurs under their account. The Company reserves the right to suspend or terminate any account that provides false information, violates this Agreement, or otherwise misuses the Platform.</p>

<h3>3. Delivery Requests &amp; Marketplace Listing</h3>
<p>When the Customer submits a Delivery Request (either directly or by promoting a saved Draft), the Platform publishes it to the driver marketplace. The Customer acknowledges that publishing a Delivery Request does not guarantee that a Driver will accept it, and that delivery times are estimates, not commitments. The Customer agrees to provide accurate pickup and drop-off addresses, vehicle information, and recipient contact details at the time of submission.</p>

<h3>4. Quotes, Payment &amp; Authorization</h3>
<p>Quotes are estimates based on the information provided at the time of the request. The actual charge may differ if the Customer modifies the request after the Quote is generated. By submitting a Delivery Request, the Customer authorizes the Company to charge the saved payment method for the full amount of the Quote. If the charge fails, the Delivery Request will be cancelled automatically and will not appear in the driver marketplace. Business Customers on postpaid invoicing are billed according to the terms separately agreed with the Company.</p>

<h3>5. Vehicle Standards Attestation</h3>
<p>The Customer attests that every vehicle submitted for delivery meets the Platform's published vehicle standards — including, where applicable, minimum fuel or battery charge levels. The Customer is responsible for any additional cost or delay caused by a vehicle that does not meet these standards at pickup.</p>

<h3>6. Cancellation &amp; Refunds</h3>
<p>The Customer may cancel a Delivery Request before a Driver has been assigned. Once a Driver has accepted the request, cancellation may be subject to a fee as published in the Platform's cancellation policy. Refunds for cancelled or failed deliveries are processed back to the original payment method and may take several business days to appear, depending on the Customer's bank.</p>

<h3>7. Recipient &amp; Access</h3>
<p>The Customer is responsible for ensuring that the recipient (or an authorized representative) is available at the drop-off location during the agreed drop-off window, and that the recipient has the pickup authorization PIN required to release the vehicle to the Driver at pickup.</p>

<h3>8. Insurance &amp; Liability</h3>
<p>Every Delivery Request includes an insurance fee that covers the vehicle during transit, subject to the coverage limits and exclusions published in the Terms of Service. The Customer agrees to cooperate with any insurance investigation, including providing evidence and documentation reasonably requested by the Company or its insurer.</p>

<h3>9. Prohibited Uses</h3>
<p>The Customer agrees not to use the Platform to request delivery of any vehicle that is stolen, illegally modified, or subject to a lien or encumbrance that prevents lawful transport. The Customer agrees not to solicit Drivers off the Platform or to circumvent the Platform's payment, rating, or dispute systems.</p>

<h3>10. Confidentiality &amp; Privacy</h3>
<p>The Customer agrees to maintain the confidentiality of any proprietary information received from the Company, including pricing, rates, and business practices. The Company's handling of personal information is described in the Privacy Policy, which is incorporated here by reference.</p>

<h3>11. Termination</h3>
<p>Either party may terminate this Agreement at any time by closing their account. The Company may suspend or terminate access immediately if the Customer breaches this Agreement, misuses the Platform, or poses a risk to other users.</p>

<h3>12. Governing Law</h3>
<p>This Agreement shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of laws provisions. Any disputes arising under this Agreement shall be resolved in the courts located in the State of California.</p>

<h3>13. Entire Agreement</h3>
<p>This Agreement, together with the Terms of Service and Privacy Policy, constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, representations, and understandings, whether written or oral.</p>

<h3>14. Acknowledgment</h3>
<p><strong>BY CHECKING THE AGREEMENT BOX DURING SIGNUP, THE CUSTOMER ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTAND, AND AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT. THE CUSTOMER FURTHER ACKNOWLEDGES THAT THEY HAVE HAD THE OPPORTUNITY TO REVIEW THIS AGREEMENT AND TO ASK QUESTIONS ABOUT ITS PROVISIONS.</strong></p>

<blockquote><strong>Placeholder content.</strong> This Customer Agreement is provided as a structured starting point. An administrator must review and refine it with legal counsel before publishing. Replace any section that does not reflect the Company's actual policy.</blockquote>`;

async function main() {
  const skipOverwrite = process.env.SKIP_OVERWRITE === "1";

  if (skipOverwrite) {
    const existing = await prisma.appSetting.findUnique({
      where: { key: DB_KEY },
    });
    if (existing) {
      const val = existing.value as any;
      const preview =
        typeof val === "string"
          ? `${val.substring(0, 60)}...`
          : `[non-string value]`;
      console.log(
        `⏭  SKIP_OVERWRITE=1 — Customer Agreement already has content:\n   ${preview}\n   No changes made.`
      );
      return;
    }
    console.log(
      `ℹ️  SKIP_OVERWRITE=1 — no existing Customer Agreement found, proceeding with placeholder seed.`
    );
  }

  console.log("Seeding Customer Agreement placeholder...\n");

  await prisma.appSetting.upsert({
    where: { key: DB_KEY },
    update: { value: CUSTOMER_AGREEMENT_HTML },
    create: { key: DB_KEY, value: CUSTOMER_AGREEMENT_HTML },
  });

  console.log(`✓ Customer Agreement placeholder → ${DB_KEY}`);
  console.log(
    `   preview: ${CUSTOMER_AGREEMENT_HTML.substring(0, 60).replace(/\n/g, " ")}...`
  );

  console.log("\n✅ Done!");
  console.log("   - Admin Content page → 'Customer Agreement' tab now shows");
  console.log("     the placeholder in the WYSIWYG editor.");
  console.log("   - Dealer signup checkbox 'Customer Agreement' link now");
  console.log("     opens PolicySheet with this content (replacing the");
  console.log("     hardcoded fallback).");
  console.log("\nNext steps:");
  console.log("   1. Open Admin → Content → Customer Agreement");
  console.log("   2. Review and refine the placeholder with legal counsel");
  console.log("   3. Save to publish");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
