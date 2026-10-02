import type { BlogPost } from "../types";

/**
 * "How Much Does Vehicle Transport Cost in California?" — content
 * extracted verbatim from the owner's hand-built route page (commit
 * 342570c) when the blog moved to the registry pattern.
 */
export const howMuchDoesVehicleTransportCostCalifornia: BlogPost = {
  slug: "how-much-does-vehicle-transport-cost-california",
  title: "How Much Does Vehicle Transport Cost in California?",
  date: "2026-08-27",
  kicker: "Updated August 2026",
  readingMinutes: 10,
  excerpt:
    "A complete 2026 pricing guide — average costs, factors that affect price, and how to save money on car delivery.",
  body: [
    {
      type: "callout",
      label: "Quick answer:",
      text: "Vehicle transport in California costs an average of **$150-$400 for in-state deliveries** and **$500-$1,500 for cross-country**. **101 Drivers** offers flat-rate pricing at **$101 for the first 25 miles + $1.80/mile** after that, with insurance included at no extra cost.",
    },
    { type: "h2", text: "Average Vehicle Transport Costs in California (2026)" },
    {
      type: "p",
      text: "Here's what you can expect to pay for vehicle transport in California in 2026:",
    },
    {
      type: "table",
      head: ["Distance", "National Carriers (Avg)", "101 Drivers"],
      highlightCol: 2,
      rows: [
        ["Under 25 miles", "$200-$400", "$101 (flat rate)"],
        ["25-100 miles", "$250-$500", "$170-$236"],
        ["100-300 miles", "$400-$700", "$236-$596"],
        ["300-500 miles", "$600-$900", "$596-$956"],
        ["500+ miles (cross-state)", "$800-$1,500", "$956+"],
      ],
      note: "*National carrier prices typically exclude insurance ($150-$300 extra) and tracking fees. 101 Drivers prices include full insurance and GPS tracking.",
    },
    { type: "h2", text: "5 Factors That Affect Vehicle Transport Cost" },
    { type: "h3", text: "1. Distance" },
    {
      type: "p",
      text: "Distance is the biggest cost factor. Longer distances cost more in total, but the per-mile rate decreases. 101 Drivers charges $101 for the first 25 miles ($4.04/mile effective), then $1.80/mile for additional miles — so longer trips have a lower per-mile cost.",
    },
    { type: "h3", text: "2. Vehicle Type" },
    {
      type: "p",
      text: "Larger vehicles (SUVs, trucks, vans) cost 10-20% more because they take up more space on transport trucks. Standard sedans are the cheapest to ship. 101 Drivers charges the same flat rate regardless of vehicle type — no SUV surcharge.",
    },
    { type: "h3", text: "3. Service Type: Open vs. Enclosed" },
    {
      type: "p",
      text: "Open transport is the standard and cheapest option — your vehicle is on an open trailer. Enclosed transport protects your vehicle from weather and road debris, but costs 30-50% more. Enclosed is recommended for luxury, classic, or exotic cars.",
    },
    { type: "h3", text: "4. Season and Timing" },
    {
      type: "p",
      text: "Auto transport prices fluctuate by season. Summer (June-August) and end-of-month are peak times with 15-25% higher prices. Winter (December-February) is cheaper. Booking 1-2 weeks in advance also gets better rates than last-minute bookings.",
    },
    { type: "h3", text: "5. Insurance Coverage" },
    {
      type: "p",
      text: "Insurance is critical — but many carriers charge extra for it. Standard carrier insurance covers $50,000-$100,000 of vehicle value. Full coverage often costs $150-$300 extra. **101 Drivers includes full insurance at no additional cost** on every delivery.",
    },
    { type: "h2", text: "101 Drivers Pricing Breakdown" },
    {
      type: "p",
      text: "101 Drivers uses a simple, transparent flat-rate pricing model:",
    },
    {
      type: "pricing",
      big: "$101",
      label: "First 25 miles (flat rate)",
      rows: [
        { k: "Each additional mile", v: "$1.80" },
        { k: "Insurance", v: "INCLUDED", included: true },
        { k: "GPS tracking", v: "INCLUDED", included: true },
        { k: "Photo proof", v: "INCLUDED", included: true },
      ],
    },
    { type: "h3", text: "Example Pricing" },
    {
      type: "ul",
      items: [
        "**LA to Santa Monica (15 miles):** $101 (flat rate)",
        "**LA to Anaheim (30 miles):** $128 ($101 + 5 miles × $1.80)",
        "**LA to San Diego (130 miles):** $308 ($101 + 105 × $1.80)",
        "**LA to San Francisco (380 miles):** $656 ($101 + 355 × $1.80)",
        "**LA to Sacramento (400 miles):** $692 ($101 + 375 × $1.80)",
      ],
    },
    { type: "h2", text: "Hidden Fees to Watch For" },
    {
      type: "p",
      text: "Hidden fees are the #1 complaint in the auto transport industry. Common fees to ask about:",
    },
    {
      type: "ul",
      items: [
        "**Insurance surcharge:** $150-$300 (often not in base quote)",
        "**Fuel surcharge:** $50-$150 (varies with gas prices)",
        "**Residential pickup fee:** $75-$150 (avoid terminal-to-terminal)",
        "**Expedited service fee:** $200-$500 (for guaranteed dates)",
        "**Cancellation fee:** $100-$300 (if you cancel after booking)",
        "**Vehicle size surcharge:** 10-20% for SUVs and trucks",
      ],
    },
    {
      type: "p",
      text: "**101 Drivers charges none of these fees** — the price you see is the price you pay.",
    },
    { type: "h2", text: "How to Save Money on Car Delivery" },
    {
      type: "ol",
      items: [
        "**Book early** — last-minute bookings cost 20-30% more",
        "**Use open transport** — saves 30-50% vs. enclosed",
        "**Choose flat-rate pricing** — avoid hidden fees with 101 Drivers",
        "**Avoid peak season** — December-February is cheapest",
        "**Bundle multiple vehicles** — dealerships save 10-15%",
        "**Be flexible with dates** — mid-week pickups cost less",
      ],
    },
    { type: "h2", text: "Frequently Asked Questions" },
    {
      type: "faq",
      items: [
        {
          q: "How much does vehicle transport cost in California?",
          a: "The average cost of vehicle transport in California is $150-$400 for in-state deliveries and $500-$1,500 for cross-country. 101 Drivers offers flat-rate pricing at $101 for the first 25 miles plus $1.80 per additional mile, with insurance included. National carriers typically charge $300-$800 for in-state deliveries, with extra fees for insurance, tracking, and expedited service.",
        },
        {
          q: "What factors affect car delivery cost in California?",
          a: "The five main factors are: (1) Distance — longer distances cost more but the per-mile rate decreases, (2) Vehicle type — larger vehicles (SUVs, trucks) cost 10-20% more, (3) Service type — enclosed transport costs 30-50% more than open, (4) Season — summer and end-of-month are pricier, (5) Insurance — some carriers charge $150-$300 extra. 101 Drivers includes insurance at no extra cost.",
        },
        {
          q: "Is car shipping cheaper than driving in California?",
          a: "For short distances under 200 miles, driving yourself is often cheaper — but factor in gas ($30-$60), wear and tear, time off work, and stress. For distances over 500 miles, professional car shipping is usually cheaper and safer. 101 Drivers' $101 flat rate for the first 25 miles is competitive with driving costs when you include all factors.",
        },
        {
          q: "How can I save money on car delivery in California?",
          a: "To save money: (1) Book early — last-minute bookings cost 20-30% more, (2) Use open transport instead of enclosed — saves 30-50%, (3) Choose a flat-rate service like 101 Drivers to avoid hidden fees, (4) Bundle multiple vehicles if you're a dealership, (5) Avoid peak season (June-August) when prices surge 15-25%.",
        },
        {
          q: "Does 101 Drivers charge extra for insurance?",
          a: "No. 101 Drivers includes full insurance coverage at no additional cost on every delivery. Your vehicle is covered from pickup to drop-off. Many national carriers charge $150-$300 extra for insurance — always ask what is included in your quote.",
        },
        {
          q: "How much does it cost to ship a car from Los Angeles to San Francisco?",
          a: "Shipping a car from Los Angeles to San Francisco (approximately 380 miles) typically costs $400-$800 with national carriers. With 101 Drivers flat-rate pricing, the cost is approximately $656 ($101 for first 25 miles + $555 for 355 additional miles at $1.80/mile), with insurance included.",
        },
        {
          q: "Are there hidden fees with car delivery services?",
          a: "Yes — hidden fees are the #1 complaint in the auto transport industry. Common hidden fees include insurance surcharges ($150-$300), fuel surcharges, residential pickup fees, expedited service fees, and cancellation fees. 101 Drivers offers transparent flat-rate pricing — the price you see is the price you pay, with no hidden fees.",
        },
      ],
    },
    { type: "h2", text: "The Bottom Line" },
    {
      type: "p",
      text: "Vehicle transport in California costs an average of $150-$400 for in-state deliveries, but prices vary widely based on the factors above. The most important thing is to choose a service with transparent pricing — no hidden fees.",
    },
    {
      type: "p",
      text: "**101 Drivers offers flat-rate pricing at $101 for the first 25 miles + $1.80/mile, with insurance, GPS tracking, and photo proof included.** No hidden fees, no surprises. Get an instant quote in 30 seconds and book in 2 minutes.",
    },
  ],
};
