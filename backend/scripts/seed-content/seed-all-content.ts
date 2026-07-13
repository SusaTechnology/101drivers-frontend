/**
 * One-time seed script for ALL content (policies + FAQs).
 *
 * Run this ONCE to populate the AppSetting table with:
 *   - Agreement (Independent Driver Agreement)
 *   - Terms (Terms of Service)
 *   - Privacy (Privacy Policy)
 *   - help-driver (Driver Help FAQs)
 *   - help-customer (Customer Help FAQs)
 *
 * After running, admins can edit all of these at /admin/content.
 * The public pages (/privacy, /terms, /help) and PolicySheet will
 * read from the database.
 *
 * Usage (from the backend/ directory):
 *   npx ts-node scripts/seed-content/seed-all-content.ts
 *
 * Or with tsx (faster):
 *   npx tsx scripts/seed-content/seed-all-content.ts
 *
 * Re-running is safe — it uses upsert, so existing content will be
 * OVERWRITTEN with the hardcoded defaults. Only run this if you want
 * to reset everything back to the original defaults.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Agreement HTML (from src/components/pages/admin-content.tsx) ──
const AGREEMENT_HTML = `<h2>Independent Driver Agreement</h2>
<p><em>Effective: April 1, 2026</em></p>
<p>This Independent Driver Agreement ("Agreement") is entered into by and between the driver ("Driver") and 101 Drivers, Inc. ("Company"). By checking the agreement box during signup, the Driver acknowledges and agrees to the following terms and conditions.</p>
<h3>1. Independent Contractor Status</h3>
<p>The Driver acknowledges and agrees that they are an independent contractor and not an employee of the Company. The Driver shall be solely responsible for determining the manner and means by which services are performed. The Company does not control the Driver's work schedule, methods, or procedures, except as may be reasonably necessary to ensure the quality of services provided. Nothing in this Agreement shall be construed to create an employment relationship, partnership, joint venture, or agency relationship between the Driver and the Company.</p>
<h3>2. Services</h3>
<p>The Driver agrees to perform vehicle delivery services as requested through the Company's platform. The Driver shall use their own vehicle, equipment, and tools to perform the services. The Driver represents that they possess a valid driver's license, appropriate insurance coverage, and any other licenses or permits required by law to perform the services.</p>
<h3>3. Compensation</h3>
<p>The Driver shall be compensated for completed delivery services as outlined on the Company's platform. Compensation rates may be adjusted by the Company from time to time with reasonable notice. The Driver acknowledges that they are responsible for all taxes, including self-employment taxes, related to the compensation received under this Agreement.</p>
<h3>4. Insurance and Liability</h3>
<p>The Driver shall maintain, at their own expense, appropriate automobile liability insurance that meets or exceeds the minimum requirements of the state(s) in which they operate. The Driver agrees to indemnify and hold harmless the Company from any claims, damages, or liabilities arising from the Driver's negligent acts or omissions in the performance of services under this Agreement.</p>
<h3>5. Background Check</h3>
<p>The Driver consents to a background check and driving record review as a condition of providing services through the Company's platform. The Company reserves the right to suspend or terminate this Agreement if the results of such checks do not meet the Company's standards.</p>
<h3>6. Confidentiality</h3>
<p>The Driver agrees to maintain the confidentiality of any proprietary or sensitive information received from the Company or its customers, including but not limited to customer contact information, delivery addresses, and business practices. This obligation survives the termination of this Agreement.</p>
<h3>7. Termination</h3>
<p>Either party may terminate this Agreement at any time, with or without cause, by providing written notice to the other party. Upon termination, the Driver shall return any Company property and cease representing themselves as affiliated with the Company.</p>
<h3>8. Governing Law</h3>
<p>This Agreement shall be governed by and construed in accordance with the laws of the State of Georgia, without regard to its conflict of laws provisions. Any disputes arising under this Agreement shall be resolved in the courts located in the State of Georgia.</p>
<h3>9. Entire Agreement</h3>
<p>This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, representations, and understandings, whether written or oral.</p>
<h3>10. Acknowledgment</h3>
<p><strong>BY CHECKING THE AGREEMENT BOX DURING DRIVER SIGNUP, THE DRIVER ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTAND, AND AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT. THE DRIVER FURTHER ACKNOWLEDGES THAT THEY HAVE HAD THE OPPORTUNITY TO REVIEW THIS AGREEMENT AND TO ASK QUESTIONS ABOUT ITS PROVISIONS.</strong></p>`;

// ── Terms HTML ──
const TERMS_HTML = `<h2>Terms of Service</h2>
<p><em>Effective date: March 2026</em></p>
<p>These Terms will govern your use of the 101 Drivers platform, including quote requests, delivery coordination, and compliance evidence handling. The terms are aligned with applicable laws for California operations.</p>
<h3>Key Concepts</h3>
<ul>
<li>Quote-first flow: you can view an estimate before providing additional details.</li>
<li>Compliance evidence: deliveries may require photos, odometer readings, and VIN last-4 verification.</li>
<li>Notifications: email-first updates (SMS optional if enabled by Admin policy).</li>
<li>Platform rules: cancellation, rescheduling, and dispute handling will follow published policies.</li>
</ul>
<h3>Accounts &amp; Eligibility</h3>
<ul>
<li>Dealers/individual customers may create delivery requests after authentication (when enabled).</li>
<li>Drivers may require onboarding and approval before booking jobs.</li>
<li>Admin oversight may be required for certain operations and compliance.</li>
</ul>`;

// ── Privacy HTML ──
const PRIVACY_HTML = `<h2>Privacy Policy</h2>
<p><em>Last updated: March 2026</em></p>
<p>101 Drivers Privacy Policy outlines how we collect, use, and share your personal information as a user of the 101 Drivers Platform. Our goal is to simplify your life by providing a reliable vehicle delivery platform, and to do so, we need to collect some of your personal information.</p>
<p>This policy applies to all users of the 101 Drivers Platform, including Customers and Drivers (including Driver applicants), and all 101 Drivers services.</p>
<h3>The Information We Collect</h3>
<ul>
<li><strong>Device Information:</strong> Hardware model, operating system, unique device identifiers, and mobile network information.</li>
<li><strong>Log Information:</strong> Browser type, access times, pages viewed, IP address, and referring page.</li>
<li><strong>Location Information:</strong> GPS signal or information about nearby Wi-Fi access points and cell towers.</li>
</ul>
<h4>Location, Usage, and Device Data</h4>
<p>For Customers, we collect your device's precise location from the time you request a vehicle delivery until it ends. For Drivers, we collect your device's precise location when you use the app. We also collect delivery information like date, time, destination, distance, route, and payment.</p>
<h4>Communications Data</h4>
<p>We facilitate phone calls and text messages between Customers and Drivers without sharing either party's actual phone number. However, we collect information about these communications, including phone numbers, date/time, and contents of SMS and chat messages.</p>
<h3>How We Use Your Information</h3>
<ul>
<li>Provide an intuitive, useful, efficient experience on our platform</li>
<li>Verify your identity, maintain your account, settings, and preferences</li>
<li>Connect you to your vehicle deliveries and provide various offerings</li>
<li>Calculate prices and process payments</li>
<li>Allow Customers and Drivers to connect and share their location</li>
<li>Communicate with you about your use of the platform</li>
<li>Maintain the security and safety of the platform and its users</li>
<li>Authenticate users, investigate and resolve incidents, prevent fraud</li>
<li>Provide customer support and improve the platform through research</li>
</ul>
<h3>How We Share Your Information</h3>
<p>We do not sell your personal information to third parties for money, and we do not act as a data broker.</p>
<ul>
<li>The Customer's vehicle pickup and destination location, name, and vehicle info</li>
<li>The Driver's name and profile photo</li>
<li>We do not share actual phone numbers or contact information</li>
</ul>
<h3>Data Retention and Security</h3>
<p>We retain your information for as long as necessary to provide you and our other users the 101 Drivers Platform. We take reasonable measures to protect your personal information, but we cannot guarantee security against unauthorized intrusions.</p>
<h3>Your Rights and Choices</h3>
<ul>
<li>Unsubscribe from commercial/promotional emails by clicking unsubscribe</li>
<li>Opt out of promotional text messages and push notifications through device settings</li>
<li>Review and edit account information through your account settings</li>
<li>Prevent location sharing through your device's system settings</li>
<li>Modify cookie settings on your browser</li>
<li>Delete your 101 Drivers account by contacting us</li>
</ul>
<h3>Contact Us</h3>
<p>For any questions or concerns about your privacy, contact us at: <a href="mailto:driver@101drivers.com">driver@101drivers.com</a></p>`;

// ── Customer FAQs (from src/components/pages/help.tsx) ──
const customerFaqs = [
  { question: 'How do I request a vehicle delivery?', answer: 'Enter your pickup and drop-off addresses on our homepage, get an instant quote, then proceed to book. You can track your delivery in real-time once a driver is assigned.' },
  { question: 'What areas do you serve?', answer: 'We currently operate in California only. Both pickup and drop-off locations must be within California.' },
  { question: 'How is the price calculated?', answer: 'Pricing is based on the driving distance between pickup and drop-off locations, plus a base fee, insurance fee, and transaction fee. You get an instant quote before committing.' },
  { question: 'Can I schedule a delivery for a specific time?', answer: "Yes! When creating a delivery, you can choose your preferred pickup or drop-off time window. We'll show you available slots based on our scheduling policies." },
  { question: 'What happens after I book a delivery?', answer: "Once submitted, your delivery is immediately visible to our driver marketplace. An available driver will accept the gig, and you'll receive a tracking link to monitor the delivery in real-time." },
  { question: 'How do I cancel a delivery?', answer: "You can cancel a delivery from your dashboard as long as it hasn't been picked up yet. Active deliveries (already in transit) cannot be cancelled — please contact support instead." },
  { question: 'Is my vehicle insured during delivery?', answer: 'Yes. Every delivery includes an insurance fee that covers the vehicle during transit. Refer to our Terms of Service for full coverage details.' },
  { question: 'What payment methods do you accept?', answer: 'We accept online payments at the time of booking. For business accounts, postpaid invoicing may be available upon approval.' },
];

// ── Driver FAQs (from src/components/pages/help.tsx) ──
const driverFaqs = [
  { question: 'How do I become a 101 Drivers driver?', answer: "Sign up on our driver registration page. You'll need to verify your email, provide your details, and get approved by our team before you can start accepting deliveries." },
  { question: 'How do I find and accept deliveries?', answer: 'Once approved, browse the job feed on your dashboard. Available deliveries are shown with distance, pay estimate, and pickup time. Tap "Book" to accept a job.' },
  { question: 'How much can I earn per delivery?', answer: "Payouts are shown upfront before you book. Most deliveries are scheduled in advance, so you can clearly see how much you'll make and plan your routes and earnings accordingly." },
  { question: 'If I deliver a car from A to B, how do I get back?', answer: "You plan your own routes. Since most jobs are in the greater Los Angeles and Southern California area, the app helps you find the next available pickup nearby so you can stay efficient and minimize deadhead miles. Many drivers use public transport or occasional Uber between jobs." },
  { question: 'Do I need to use my own car?', answer: "No. You don't need your own car for this job. You're only driving the customer's vehicle from pickup to drop-off, so you have zero car expenses — making your net earnings much higher than rideshare or delivery gigs." },
  { question: 'Am I insured while delivering?', answer: 'Yes. All drivers are fully insured by 101 Drivers Inc. from the moment you start the delivery until it is completed.' },
  { question: 'As a driver, what happens after I start a delivery?', answer: 'Once you start the delivery, make sure your dashcam is recording, keep your phone screen on, and follow the exact route shown on the map. This is very important for insurance purposes.' },
  { question: 'What is the pickup checklist?', answer: "Before starting a trip, you must: (1) get the 4-digit authorization PIN from the customer, (2) confirm you are at the vehicle, (3) take 6 photos of the vehicle clockwise — Left Front Corner, Right Front Corner, Passenger Side, Right Rear Corner, Left Rear Corner, Driver's Side, (4) take ONE dashboard/touchscreen photo that clearly shows the fuel gauge or battery charge level (the vehicle must have at least half a tank or half charge), and (5) enter the current odometer reading and the last 4 digits of the VIN. All steps are required." },
  { question: 'Do I need to take a picture of the fuel/charge level?', answer: 'Yes. The vehicle must have at least half a tank of gas or half battery charge. Always take a clear photo of the dashboard or touchscreen showing the fuel gauge or charge indicator before starting delivery. For Teslas and other EVs, the touchscreen counts as the dashboard — make sure the battery charge level is clearly visible.' },
  { question: 'What is the drop-off checklist?', answer: 'At drop-off, record the final odometer reading (must be higher than pickup), and take 6 photos showing the vehicle at the destination. Complete the trip to trigger payment.' },
  { question: 'How and when do I get paid?', answer: 'Payment is processed automatically after trip completion. Your share is calculated based on the delivery fee minus platform and insurance fees. Payouts are managed by the 101 Drivers team.' },
  { question: 'Can I set my preferred areas?', answer: 'Yes! Go to your preferences to set your home city, preferred radius, and district preferences. The job feed prioritizes deliveries near your location.' },
  { question: 'How do I change my profile picture?', answer: 'Your profile picture must be a clear, front-facing photo with no sunglasses or hats. If you need to update it, please contact customer support — changes can only be made in person.' },
  { question: "What if there's an issue during delivery?", answer: 'Use the "Report Issue" button on your active delivery screen to submit a support request immediately. Our operations team will assist you.' },
  { question: 'Can I cancel a delivery I already accepted?', answer: "Drivers cannot cancel deliveries directly. If there's a problem, please report it through the app so our team can assist or reassign the delivery." },
];

async function seedContent(key: string, value: any, label: string) {
  const dbKey = `CONTENT_${key.toUpperCase()}`;
  await prisma.appSetting.upsert({
    where: { key: dbKey },
    update: { value },
    create: { key: dbKey, value },
  });
  const preview = typeof value === "string" ? `${value.substring(0, 60)}...` : `[${value.length} items]`;
  console.log(`✓ ${label.padEnd(35)} → ${dbKey}  (${preview})`);
}

async function main() {
  console.log("Seeding all content (policies + FAQs)...\n");

  await seedContent("agreement", AGREEMENT_HTML, "Independent Driver Agreement");
  await seedContent("terms", TERMS_HTML, "Terms of Service");
  await seedContent("privacy", PRIVACY_HTML, "Privacy Policy");
  await seedContent("help-driver", driverFaqs as any, `Driver Help FAQs (${driverFaqs.length} items)`);
  await seedContent("help-customer", customerFaqs as any, `Customer Help FAQs (${customerFaqs.length} items)`);

  console.log("\n✅ Done! All content seeded to the database.");
  console.log("   - Public pages (/privacy, /terms) now read from the DB");
  console.log("   - PolicySheet (driver signup) now reads from the DB");
  console.log("   - Help pages (/help) now read FAQs from the DB");
  console.log("   - Admins can edit everything at /admin/content");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
