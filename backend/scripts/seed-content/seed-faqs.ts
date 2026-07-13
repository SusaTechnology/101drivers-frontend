/**
 * One-time seed script for FAQ content.
 *
 * Run this ONCE to populate the AppSetting table with the existing
 * hardcoded FAQs from src/components/pages/help.tsx so the help pages
 * can read from the database instead of the hardcoded arrays.
 *
 * After running, the admin can edit FAQs at /admin/content →
 * "Driver Help FAQs" / "Customer Help FAQs" tabs.
 *
 * Usage (from the backend/ directory):
 *   npx ts-node scripts/seed-content/seed-faqs.ts
 *
 * Or with tsx (faster):
 *   npx tsx scripts/seed-content/seed-faqs.ts
 *
 * Re-running is safe — it uses upsert, so existing content will be
 * OVERWRITTEN with the hardcoded defaults. Only run this if you want
 * to reset the FAQs back to the original defaults.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Customer FAQs (copied from src/components/pages/help.tsx) ──
const customerFaqs = [
  {
    question: 'How do I request a vehicle delivery?',
    answer:
      'Enter your pickup and drop-off addresses on our homepage, get an instant quote, then proceed to book. You can track your delivery in real-time once a driver is assigned.',
  },
  {
    question: 'What areas do you serve?',
    answer:
      'We currently operate in California only. Both pickup and drop-off locations must be within California.',
  },
  {
    question: 'How is the price calculated?',
    answer:
      'Pricing is based on the driving distance between pickup and drop-off locations, plus a base fee, insurance fee, and transaction fee. You get an instant quote before committing.',
  },
  {
    question: 'Can I schedule a delivery for a specific time?',
    answer:
      "Yes! When creating a delivery, you can choose your preferred pickup or drop-off time window. We'll show you available slots based on our scheduling policies.",
  },
  {
    question: 'What happens after I book a delivery?',
    answer:
      "Once submitted, your delivery is immediately visible to our driver marketplace. An available driver will accept the gig, and you'll receive a tracking link to monitor the delivery in real-time.",
  },
  {
    question: 'How do I cancel a delivery?',
    answer:
      "You can cancel a delivery from your dashboard as long as it hasn't been picked up yet. Active deliveries (already in transit) cannot be cancelled — please contact support instead.",
  },
  {
    question: 'Is my vehicle insured during delivery?',
    answer:
      'Yes. Every delivery includes an insurance fee that covers the vehicle during transit. Refer to our Terms of Service for full coverage details.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept online payments at the time of booking. For business accounts, postpaid invoicing may be available upon approval.',
  },
];

// ── Driver FAQs (copied from src/components/pages/help.tsx) ──
const driverFaqs = [
  {
    question: 'How do I become a 101 Drivers driver?',
    answer:
      "Sign up on our driver registration page. You'll need to verify your email, provide your details, and get approved by our team before you can start accepting deliveries.",
  },
  {
    question: 'How do I find and accept deliveries?',
    answer:
      'Once approved, browse the job feed on your dashboard. Available deliveries are shown with distance, pay estimate, and pickup time. Tap "Book" to accept a job.',
  },
  {
    question: 'How much can I earn per delivery?',
    answer:
      "Payouts are shown upfront before you book. Most deliveries are scheduled in advance, so you can clearly see how much you'll make and plan your routes and earnings accordingly.",
  },
  {
    question: 'If I deliver a car from A to B, how do I get back?',
    answer:
      "You plan your own routes. Since most jobs are in the greater Los Angeles and Southern California area, the app helps you find the next available pickup nearby so you can stay efficient and minimize deadhead miles. Many drivers use public transport or occasional Uber between jobs.",
  },
  {
    question: 'Do I need to use my own car?',
    answer:
      "No. You don't need your own car for this job. You're only driving the customer's vehicle from pickup to drop-off, so you have zero car expenses — making your net earnings much higher than rideshare or delivery gigs.",
  },
  {
    question: 'Am I insured while delivering?',
    answer:
      'Yes. All drivers are fully insured by 101 Drivers Inc. from the moment you start the delivery until it is completed.',
  },
  {
    question: 'As a driver, what happens after I start a delivery?',
    answer:
      'Once you start the delivery, make sure your dashcam is recording, keep your phone screen on, and follow the exact route shown on the map. This is very important for insurance purposes.',
  },
  {
    question: 'What is the pickup checklist?',
    answer:
      "Before starting a trip, you must: (1) get the 4-digit authorization PIN from the customer, (2) confirm you are at the vehicle, (3) take 6 photos of the vehicle clockwise — Left Front Corner, Right Front Corner, Passenger Side, Right Rear Corner, Left Rear Corner, Driver's Side, (4) take ONE dashboard/touchscreen photo that clearly shows the fuel gauge or battery charge level (the vehicle must have at least half a tank or half charge), and (5) enter the current odometer reading and the last 4 digits of the VIN. All steps are required.",
  },
  {
    question: 'Do I need to take a picture of the fuel/charge level?',
    answer:
      'Yes. The vehicle must have at least half a tank of gas or half battery charge. Always take a clear photo of the dashboard or touchscreen showing the fuel gauge or charge indicator before starting delivery. For Teslas and other EVs, the touchscreen counts as the dashboard — make sure the battery charge level is clearly visible.',
  },
  {
    question: 'What is the drop-off checklist?',
    answer:
      'At drop-off, record the final odometer reading (must be higher than pickup), and take 6 photos showing the vehicle at the destination. Complete the trip to trigger payment.',
  },
  {
    question: 'How and when do I get paid?',
    answer:
      'Payment is processed automatically after trip completion. Your share is calculated based on the delivery fee minus platform and insurance fees. Payouts are managed by the 101 Drivers team.',
  },
  {
    question: 'Can I set my preferred areas?',
    answer:
      'Yes! Go to your preferences to set your home city, preferred radius, and district preferences. The job feed prioritizes deliveries near your location.',
  },
  {
    question: 'How do I change my profile picture?',
    answer:
      'Your profile picture must be a clear, front-facing photo with no sunglasses or hats. If you need to update it, please contact customer support — changes can only be made in person.',
  },
  {
    question: "What if there's an issue during delivery?",
    answer:
      'Use the "Report Issue" button on your active delivery screen to submit a support request immediately. Our operations team will assist you.',
  },
  {
    question: 'Can I cancel a delivery I already accepted?',
    answer:
      "Drivers cannot cancel deliveries directly. If there's a problem, please report it through the app so our team can assist or reassign the delivery.",
  },
];

async function main() {
  console.log("Seeding FAQ content...\n");

  // Customer FAQs → CONTENT_HELP-CUSTOMER
  await prisma.appSetting.upsert({
    where: { key: "CONTENT_HELP-CUSTOMER" },
    update: { value: customerFaqs as any },
    create: { key: "CONTENT_HELP-CUSTOMER", value: customerFaqs as any },
  });
  console.log(`✓ Seeded ${customerFaqs.length} customer FAQs → CONTENT_HELP-CUSTOMER`);

  // Driver FAQs → CONTENT_HELP-DRIVER
  await prisma.appSetting.upsert({
    where: { key: "CONTENT_HELP-DRIVER" },
    update: { value: driverFaqs as any },
    create: { key: "CONTENT_HELP-DRIVER", value: driverFaqs as any },
  });
  console.log(`✓ Seeded ${driverFaqs.length} driver FAQs → CONTENT_HELP-DRIVER`);

  console.log("\nDone! The help pages will now read from the database.");
  console.log("Admins can edit FAQs at /admin/content → Driver/Customer Help FAQs tabs.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
