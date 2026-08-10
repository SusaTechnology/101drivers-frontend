/**
 * One-time combined seed script for ALL Customer content:
 *   - customer-agreement (Customer Agreement)
 *   - customer-terms    (Customer Terms of Service)
 *   - customer-privacy  (Customer Privacy Policy)
 *
 * Writes structured PLACEHOLDER HTML to AppSetting for each key. The
 * placeholders show up immediately in the WYSIWYG editor at
 * /admin/content → 'Customer Agreement' / 'Customer Terms of Service' /
 * 'Customer Privacy Policy' tabs, so an admin can refine them instead
 * of starting from a blank page.
 *
 * ─────────────────────────────────────────────────────────────────────
 * IMPORTANT: These are CUSTOMER versions, distinct from the driver-facing
 * ones (agreement / terms / privacy). Driver flows keep using the
 * driver versions; the dealer signup form uses the customer versions.
 * ─────────────────────────────────────────────────────────────────────
 *
 * Usage (from the backend/ directory):
 *   npx tsx scripts/seed-content/seed-customer-content.ts
 *
 * To skip keys that already have published content (avoids clobbering
 * a published version on accidental re-run):
 *   SKIP_OVERWRITE=1 npx tsx scripts/seed-content/seed-customer-content.ts
 *
 * Re-running without SKIP_OVERWRITE is safe — uses upsert, will
 * OVERWRITE existing content with the placeholder defaults.
 */

import { PrismaClient } from "@prisma/client";

// schema.prisma reads env("DB_URL"), but some deployments only set
// DATABASE_URL. Fall back so this script runs in either environment.
if (!process.env.DB_URL && process.env.DATABASE_URL) {
  process.env.DB_URL = process.env.DATABASE_URL;
}

const prisma = new PrismaClient();

// ── Customer Agreement HTML (mirrors seed-customer-agreement.ts) ──
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
<p>The Customer agrees to maintain the confidentiality of any proprietary information received from the Company, including pricing, rates, and business practices. The Company's handling of personal information is described in the Customer Privacy Policy, which is incorporated here by reference.</p>

<h3>11. Termination</h3>
<p>Either party may terminate this Agreement at any time by closing their account. The Company may suspend or terminate access immediately if the Customer breaches this Agreement, misuses the Platform, or poses a risk to other users.</p>

<h3>12. Governing Law</h3>
<p>This Agreement shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of laws provisions. Any disputes arising under this Agreement shall be resolved in the courts located in the State of California.</p>

<h3>13. Entire Agreement</h3>
<p>This Agreement, together with the Customer Terms of Service and Customer Privacy Policy, constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, representations, and understandings, whether written or oral.</p>

<h3>14. Acknowledgment</h3>
<p><strong>BY CHECKING THE AGREEMENT BOX DURING SIGNUP, THE CUSTOMER ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTAND, AND AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT. THE CUSTOMER FURTHER ACKNOWLEDGES THAT THEY HAVE HAD THE OPPORTUNITY TO REVIEW THIS AGREEMENT AND TO ASK QUESTIONS ABOUT ITS PROVISIONS.</strong></p>

<blockquote><strong>Placeholder content.</strong> This Customer Agreement is provided as a structured starting point. An administrator must review and refine it with legal counsel before publishing. Replace any section that does not reflect the Company's actual policy. This Agreement is distinct from the driver-facing Independent Driver Agreement.</blockquote>`;

// ── Customer Terms of Service HTML ──
const CUSTOMER_TERMS_HTML = `<h2>Customer Terms of Service</h2>
<p><em>Effective date: To be set by administrator.</em></p>
<p>These Customer Terms of Service ("Terms") govern the use of the 101 Drivers platform by customers and dealers ("Customer") for booking and managing vehicle delivery services. By creating an account or submitting a Delivery Request, the Customer agrees to be bound by these Terms.</p>

<h3>1. Acceptance of Terms</h3>
<p>By accessing or using the 101 Drivers platform, the Customer agrees to these Terms, the Customer Agreement, and the Customer Privacy Policy. If the Customer does not agree to any of these terms, they must not use the platform.</p>

<h3>2. Account Registration</h3>
<p>The Customer must provide accurate and complete information during registration and keep that information current. The Customer is responsible for safeguarding their account credentials and for all activity that occurs under their account. The Customer must notify the Company immediately of any unauthorized use of their account.</p>

<h3>3. Delivery Requests &amp; Quotes</h3>
<p>Quotes are estimates based on the information provided at the time of the request. The actual charge may differ if the Customer modifies the request after the Quote is generated. The Customer acknowledges that submitting a Delivery Request does not guarantee a Driver will accept it, and that estimated pickup and drop-off times are not guaranteed commitments.</p>

<h3>4. Payment &amp; Billing</h3>
<p>By submitting a Delivery Request, the Customer authorizes the Company to charge the saved payment method for the full amount of the Quote. If the charge fails, the Delivery Request will be cancelled automatically. Business Customers on postpaid invoicing are billed according to the terms separately agreed with the Company. All charges are non-refundable except as described in the Cancellation &amp; Refunds section.</p>

<h3>5. Customer Responsibilities</h3>
<p>The Customer agrees to: (a) provide accurate pickup and drop-off addresses; (b) ensure the vehicle is accessible at the scheduled pickup time; (c) provide the pickup authorization PIN to the Driver; (d) ensure the recipient or an authorized representative is available at the drop-off location during the agreed window; and (e) ensure the vehicle meets the Platform's published vehicle standards, including minimum fuel or battery charge levels.</p>

<h3>6. Vehicle Standards</h3>
<p>The Customer attests that every vehicle submitted for delivery meets the Platform's published vehicle standards. The Customer is responsible for any additional cost or delay caused by a vehicle that does not meet these standards at pickup.</p>

<h3>7. Cancellation &amp; Refunds</h3>
<p>The Customer may cancel a Delivery Request before a Driver has been assigned at no charge. Once a Driver has accepted the request, cancellation may be subject to a fee as published in the Platform's cancellation policy. Refunds for cancelled or failed deliveries are processed back to the original payment method and may take several business days to appear, depending on the Customer's bank.</p>

<h3>8. Insurance</h3>
<p>Every Delivery Request includes an insurance fee that covers the vehicle during transit, subject to the coverage limits and exclusions published by the Company. The Customer agrees to cooperate with any insurance investigation, including providing evidence and documentation reasonably requested by the Company or its insurer.</p>

<h3>9. Prohibited Conduct</h3>
<p>The Customer agrees not to: (a) use the Platform to request delivery of any vehicle that is stolen, illegally modified, or subject to a lien or encumbrance that prevents lawful transport; (b) solicit Drivers off the Platform; (c) circumvent the Platform's payment, rating, or dispute systems; or (d) use the Platform for any unlawful purpose.</p>

<h3>10. Dispute Resolution</h3>
<p>Any dispute arising out of or relating to these Terms or the use of the Platform will be resolved through the Company's published dispute resolution process. If the dispute cannot be resolved informally, it shall be resolved by binding arbitration administered in the State of California under the Federal Arbitration Act.</p>

<h3>11. Limitation of Liability</h3>
<p>To the maximum extent permitted by law, the Company's total liability for any claim arising out of or relating to these Terms or the use of the Platform is limited to the amount the Customer paid to the Company for the Delivery Request giving rise to the claim. The Company is not liable for indirect, incidental, special, consequential, or punitive damages.</p>

<h3>12. Changes to Terms</h3>
<p>The Company may modify these Terms at any time by posting the updated Terms on the Platform. The Customer's continued use of the Platform after the effective date of any change constitutes acceptance of the updated Terms.</p>

<h3>13. Governing Law</h3>
<p>These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of laws provisions. Any disputes arising under these Terms shall be resolved in the courts located in the State of California.</p>

<h3>14. Contact</h3>
<p>For any questions about these Terms, contact: <a href="mailto:support@101drivers.com">support@101drivers.com</a></p>

<blockquote><strong>Placeholder content.</strong> These Customer Terms of Service are provided as a starting point. An administrator must review and refine them with legal counsel before publishing. These Terms are distinct from the driver-facing Terms of Service.</blockquote>`;

// ── Customer Privacy Policy HTML ──
const CUSTOMER_PRIVACY_HTML = `<h2>Customer Privacy Policy</h2>
<p><em>Last updated: To be set by administrator.</em></p>
<p>This Customer Privacy Policy describes how 101 Drivers, Inc. ("Company") collects, uses, and shares personal information of customers and dealers ("Customer") who use the 101 Drivers platform to book and manage vehicle delivery services.</p>

<h3>1. Information We Collect</h3>
<p>We collect the following categories of information from Customers:</p>
<ul>
<li><strong>Account Information:</strong> Name, email address, phone number, password (hashed), and account preferences.</li>
<li><strong>Business Information:</strong> For business customers, business name, business address, contact information, and monthly delivery volume estimates.</li>
<li><strong>Payment Information:</strong> Stripe customer ID, saved payment method identifiers (we do not store full card numbers).</li>
<li><strong>Vehicle Information:</strong> License plate, make, model, color, VIN last-4, and vehicle standards attestation.</li>
<li><strong>Recipient Information:</strong> Recipient name, email, and phone number for delivery coordination.</li>
<li><strong>Delivery Information:</strong> Pickup and drop-off addresses, scheduled times, delivery status, and compliance evidence (photos, odometer readings).</li>
<li><strong>Location Information:</strong> Precise device location during active delivery coordination, and approximate location for marketplace matching.</li>
</ul>

<h3>2. How We Use Your Information</h3>
<p>We use Customer information to:</p>
<ul>
<li>Register and authenticate Customer accounts</li>
<li>Process Delivery Requests, Quotes, and payments</li>
<li>Coordinate pickup and drop-off with Drivers</li>
<li>Provide real-time tracking and delivery status updates</li>
<li>Investigate and resolve disputes, claims, and insurance incidents</li>
<li>Detect and prevent fraud, abuse, and prohibited conduct</li>
<li>Provide customer support and improve the Platform</li>
<li>Send service notifications (email-first; SMS optional if enabled by the Customer)</li>
</ul>

<h3>3. How We Share Your Information</h3>
<p>We share Customer information with the following categories of recipients, only as necessary to provide the Service:</p>
<ul>
<li><strong>Drivers:</strong> Pickup and drop-off addresses, vehicle information, recipient contact information, and pickup authorization PIN — only after a Driver accepts the Delivery Request.</li>
<li><strong>Payment Processors:</strong> Stripe and other payment processors to charge saved payment methods and process refunds.</li>
<li><strong>Insurance Partners:</strong> Coverage and claims information in the event of an insurance incident during transit.</li>
<li><strong>Service Providers:</strong> Infrastructure, analytics, and communications providers that support the Platform.</li>
<li><strong>Legal Authorities:</strong> When required by law, court order, or to protect the rights, property, or safety of the Company, its users, or others.</li>
</ul>
<p>We do not sell Customer personal information to third parties for money.</p>

<h3>4. Data Retention</h3>
<p>We retain Customer information for as long as the account is active, and for a reasonable period thereafter to comply with legal obligations, resolve disputes, and enforce agreements. Delivery records and compliance evidence may be retained for longer periods as required by insurance, tax, or regulatory requirements.</p>

<h3>5. Security</h3>
<p>We take reasonable measures to protect Customer information, including encryption in transit and at rest, access controls, and regular security reviews. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.</p>

<h3>6. Customer Rights</h3>
<p>Customers have the following rights regarding their personal information:</p>
<ul>
<li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
<li><strong>Correction:</strong> Request correction of inaccurate or incomplete information.</li>
<li><strong>Deletion:</strong> Request deletion of your personal information, subject to legal retention obligations.</li>
<li><strong>Opt-Out:</strong> Unsubscribe from promotional emails and text messages at any time.</li>
<li><strong>Data Portability:</strong> Receive your personal information in a structured, machine-readable format.</li>
</ul>
<p>To exercise any of these rights, contact us at <a href="mailto:support@101drivers.com">support@101drivers.com</a>.</p>

<h3>7. Cookies</h3>
<p>The Platform uses cookies and similar technologies for authentication, session management, and analytics. Customers can control cookies through their browser settings, but disabling cookies may affect Platform functionality.</p>

<h3>8. Children's Privacy</h3>
<p>The Platform is not directed to children under 18, and we do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.</p>

<h3>9. Changes to This Policy</h3>
<p>We may update this Privacy Policy from time to time. We will notify Customers of material changes by email or by posting a notice on the Platform. The Customer's continued use of the Platform after the effective date constitutes acceptance of the updated policy.</p>

<h3>10. Contact Us</h3>
<p>For any questions or concerns about this Privacy Policy, contact:</p>
<p><a href="mailto:support@101drivers.com">support@101drivers.com</a></p>

<blockquote><strong>Placeholder content.</strong> This Customer Privacy Policy is provided as a starting point. An administrator must review and refine it with legal counsel before publishing. This Privacy Policy is distinct from the driver-facing Privacy Policy.</blockquote>`;

type CustomerDoc = {
  key: string;
  dbKey: string;
  label: string;
  html: string;
};

const DOCS: CustomerDoc[] = [
  {
    key: "customer-agreement",
    dbKey: "CONTENT_CUSTOMER-AGREEMENT",
    label: "Customer Agreement",
    html: CUSTOMER_AGREEMENT_HTML,
  },
  {
    key: "customer-terms",
    dbKey: "CONTENT_CUSTOMER-TERMS",
    label: "Customer Terms of Service",
    html: CUSTOMER_TERMS_HTML,
  },
  {
    key: "customer-privacy",
    dbKey: "CONTENT_CUSTOMER-PRIVACY",
    label: "Customer Privacy Policy",
    html: CUSTOMER_PRIVACY_HTML,
  },
];

async function seedOne(doc: CustomerDoc, skipOverwrite: boolean): Promise<boolean> {
  if (skipOverwrite) {
    const existing = await prisma.appSetting.findUnique({
      where: { key: doc.dbKey },
    });
    if (existing) {
      const val = existing.value as any;
      const preview =
        typeof val === "string"
          ? `${val.substring(0, 60).replace(/\n/g, " ")}...`
          : `[non-string value]`;
      console.log(
        `⏭  SKIP — ${doc.label} (${doc.dbKey}) already has content:\n   ${preview}`
      );
      return false;
    }
  }

  await prisma.appSetting.upsert({
    where: { key: doc.dbKey },
    update: { value: doc.html },
    create: { key: doc.dbKey, value: doc.html },
  });

  const preview = doc.html.substring(0, 60).replace(/\n/g, " ");
  console.log(`✓ ${doc.label.padEnd(35)} → ${doc.dbKey}  (${preview}...)`);
  return true;
}

async function main() {
  const skipOverwrite = process.env.SKIP_OVERWRITE === "1";

  console.log(
    `Seeding Customer content (${DOCS.length} documents)${
      skipOverwrite ? " [SKIP_OVERWRITE=1 — will skip published keys]" : ""
    }...\n`
  );

  let seeded = 0;
  let skipped = 0;
  for (const doc of DOCS) {
    const didSeed = await seedOne(doc, skipOverwrite);
    if (didSeed) seeded++;
    else skipped++;
  }

  console.log(
    `\n✅ Done! Seeded ${seeded} document(s)${
      skipped > 0 ? `, skipped ${skipped} (already published)` : ""
    }.`
  );
  console.log("\nAdmin Content page tabs now show the placeholders:");
  DOCS.forEach((d) =>
    console.log(`   - ${d.label} (key: ${d.key})`)
  );
  console.log("\nDealer signup checkbox now opens Customer versions:");
  console.log("   - Customer Agreement  → customer-agreement");
  console.log("   - Terms of Service     → customer-terms");
  console.log("   - Privacy Policy       → customer-privacy");
  console.log("\nNext steps:");
  console.log("   1. Open Admin → Content → each Customer tab");
  console.log("   2. Review and refine the placeholder with legal counsel");
  console.log("   3. Save each one to publish");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
