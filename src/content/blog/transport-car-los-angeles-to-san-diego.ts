import type { BlogPost } from "../types";

/**
 * "How to Transport a Car from Los Angeles to San Diego" — content
 * extracted verbatim from the owner's hand-built route page (commit
 * 342570c) when the blog moved to the registry pattern.
 */
export const transportCarLosAngelesToSanDiego: BlogPost = {
  slug: "transport-car-los-angeles-to-san-diego",
  title: "How to Transport a Car from Los Angeles to San Diego",
  date: "2026-08-27",
  kicker: "Route guide",
  readingMinutes: 8,
  excerpt:
    "The complete 2026 guide — cost, timing, options, and tips for the LA → SD route.",
  body: [
    {
      type: "callout",
      label: "Quick answer:",
      text: "Transporting a car from Los Angeles to San Diego (about 130 miles) costs **$308 with 101 Drivers** flat-rate (insurance + GPS included). The drive takes 2-3 hours; shipping takes 4-6 hours total with no effort on your part.",
    },
    { type: "h2", text: "Route Overview: LA to San Diego" },
    {
      type: "p",
      text: "The Los Angeles to San Diego route is one of the most popular car transport routes in California. The drive is approximately 130 miles via I-5 South or I-405 S to I-5 S, and typically takes 2-3 hours depending on traffic.",
    },
    {
      type: "ul",
      items: [
        "**Distance:** ~130 miles",
        "**Drive time:** 2-3 hours (without traffic)",
        "**Major routes:** I-5 S, I-405 S to I-5 S",
        "**101 Drivers cost:** $308 (flat rate, insurance included)",
        "**101 Drivers time:** 4-6 hours total (pickup + transit + drop-off)",
      ],
    },
    { type: "h2", text: "Cost Comparison: LA to San Diego Car Transport" },
    {
      type: "table",
      head: ["Service", "Cost", "Time", "Insurance"],
      highlightRow: 0,
      rows: [
        ["101 Drivers", "$308", "4-6 hours", "INCLUDED"],
        ["National carriers", "$400-$700", "1-3 days", "+$150-$300"],
        ["uShip (auction)", "$200-$500", "Varies", "Varies"],
        ["Drive yourself", "$40-$60 (gas)", "2-3 hours", "Your policy"],
      ],
    },
    { type: "h2", text: "How 101 Drivers Pricing Works for LA → San Diego" },
    {
      type: "pricing",
      big: "$308",
      label: "Total cost (insurance + tracking included)",
      rows: [
        { k: "First 25 miles (flat rate)", v: "$101" },
        { k: "Next 105 miles × $1.80/mile", v: "$189" },
        { k: "Insurance (full coverage)", v: "INCLUDED", included: true },
        { k: "GPS tracking", v: "INCLUDED", included: true },
        { k: "Photo proof of delivery", v: "INCLUDED", included: true },
      ],
    },
    { type: "h2", text: "Step-by-Step: How to Ship Your Car from LA to San Diego" },
    { type: "h3", text: "Step 1: Get an Instant Quote" },
    {
      type: "p",
      text: "Go to [101drivers.com](/) and enter your LA pickup address and San Diego drop-off address. You'll see a flat-rate quote of $308 in 30 seconds — no waiting, no quotes needed.",
    },
    { type: "h3", text: "Step 2: Book Online" },
    {
      type: "p",
      text: "Choose your pickup time and date. Book in 2 minutes — no account required for individuals. Dealerships can create a free account for streamlined booking.",
    },
    { type: "h3", text: "Step 3: Meet Your Driver in LA" },
    {
      type: "p",
      text: "Your vetted driver arrives at your LA location, photographs your vehicle's condition, and begins the journey. You receive a tracking link via SMS and email.",
    },
    { type: "h3", text: "Step 4: Track in Real-Time" },
    {
      type: "p",
      text: "Watch your vehicle move from LA to San Diego on a live map. See driver location, ETA, and route. Get notified when your vehicle is picked up and when it's approaching the destination.",
    },
    { type: "h3", text: "Step 5: Receive in San Diego" },
    {
      type: "p",
      text: "Your driver arrives at your San Diego address, photographs the vehicle condition at delivery, and you confirm receipt. Payment is processed only after successful delivery.",
    },
    { type: "h2", text: "Tips for LA to San Diego Car Transport" },
    {
      type: "ul",
      items: [
        "**Book in advance:** Book 1-2 days ahead for best availability, though same-day is often available.",
        "**Avoid rush hour:** LA traffic is worst 7-10 AM and 4-7 PM. Mid-morning or early afternoon pickups save time.",
        "**Take photos:** Take your own photos of your vehicle before pickup for your records.",
        "**Remove valuables:** Remove personal items from the vehicle before transport.",
        "**Check fuel level:** Keep fuel between 1/4 and 1/2 tank — enough for loading/unloading.",
        "**Disable alarms:** Disable car alarms before pickup to avoid issues during transport.",
      ],
    },
    { type: "h2", text: "San Diego Service Areas" },
    { type: "p", text: "101 Drivers delivers to all of San Diego County, including:" },
    {
      type: "chips",
      items: [
        "Downtown San Diego",
        "La Jolla",
        "Pacific Beach",
        "Mission Valley",
        "Chula Vista",
        "Carlsbad",
        "Escondido",
        "Oceanside",
        "El Cajon",
        "San Marcos",
        "Vista",
        "Encinitas",
        "National City",
        "Imperial Beach",
        "Coronado",
        "Spring Valley",
        "Santee",
        "Lemon Grove",
      ],
    },
    { type: "h2", text: "Frequently Asked Questions" },
    {
      type: "faq",
      items: [
        {
          q: "How much does it cost to ship a car from Los Angeles to San Diego?",
          a: "Shipping a car from Los Angeles to San Diego (approximately 130 miles) costs $308 with 101 Drivers flat-rate pricing ($101 for first 25 miles + $1.80/mile for 105 additional miles). Insurance, GPS tracking, and photo proof are included. National carriers typically charge $400-$700 for the same route.",
        },
        {
          q: "How long does it take to transport a car from LA to San Diego?",
          a: "101 Drivers typically completes LA to San Diego deliveries within 4-6 hours, including pickup and drop-off. The drive itself takes about 2-3 hours depending on traffic. National carriers often take 1-3 days for the same route.",
        },
        {
          q: "What is the cheapest way to ship a car from Los Angeles to San Diego?",
          a: "The cheapest way to ship a car from LA to San Diego is using 101 Drivers flat-rate service at $308, which includes insurance and tracking. Avoid auction-based platforms and national carriers with hidden fees. Driving yourself costs about $40-$60 in gas + your time, but adds 130 miles to your vehicle.",
        },
        {
          q: "Can I track my car during transport from LA to San Diego?",
          a: "Yes. 101 Drivers provides real-time GPS tracking on every LA to San Diego delivery. You receive a tracking link via SMS and email and can see your vehicle on a live map, see the driver's location, ETA, and receive photo proof of pickup and delivery.",
        },
        {
          q: "Is my vehicle insured during transport from LA to San Diego?",
          a: "Yes. 101 Drivers includes full insurance coverage at no additional cost on every delivery, including LA to San Diego. Your vehicle is covered from pickup to drop-off. Many national carriers charge $150-$300 extra for insurance.",
        },
        {
          q: "What areas in San Diego do you deliver to?",
          a: "101 Drivers delivers to all of San Diego County including Downtown San Diego, La Jolla, Pacific Beach, Mission Valley, Chula Vista, Carlsbad, Escondido, Oceanside, El Cajon, San Marcos, Vista, Encinitas, National City, Imperial Beach, and all other San Diego neighborhoods.",
        },
        {
          q: "Can I ship a car from LA to San Diego same-day?",
          a: "Yes. 101 Drivers offers same-day delivery for most LA to San Diego routes. Book before 11 AM for same-day pickup. Most deliveries are completed within 4-6 hours from booking.",
        },
      ],
    },
    { type: "h2", text: "The Bottom Line" },
    {
      type: "p",
      text: "Shipping a car from Los Angeles to San Diego with 101 Drivers costs **$308 flat-rate**, includes insurance + GPS tracking, and takes 4-6 hours total. It's cheaper, safer, and faster than driving yourself or using national carriers with hidden fees.",
    },
  ],
};
