import type { BlogPost } from "../types";

/**
 * "Dealership Vehicle Transport Guide" — content extracted verbatim from
 * the owner's hand-built route page (commit 342570c) when the blog moved
 * to the registry pattern.
 */
export const dealershipVehicleTransportGuide: BlogPost = {
  slug: "dealership-vehicle-transport-guide",
  title: "Dealership Vehicle Transport Guide",
  date: "2026-08-27",
  kicker: "For dealerships",
  readingMinutes: 12,
  excerpt:
    "Everything dealerships need to know about vehicle transport in California — bulk delivery, auctions, trade-ins, and customer home delivery.",
  body: [
    {
      type: "callout",
      label: "For dealership owners and managers:",
      text: "101 Drivers offers California dealerships a modern, transparent alternative to traditional auto transport brokers. Get **flat-rate pricing, real-time GPS tracking, a dealer dashboard, and 20-30% savings** vs. national carriers — with insurance included on every delivery.",
    },
    { type: "h2", text: "Why Dealerships Choose 101 Drivers" },
    {
      type: "p",
      text: "Running a dealership means moving vehicles constantly — from auctions, trade-ins, customer home deliveries, dealer-to-dealer transfers, and inventory repositioning. Traditional auto transport brokers make this painful with variable pricing, hidden fees, and no real-time visibility.",
    },
    { type: "p", text: "101 Drivers is built for dealerships. Here's what makes us different:" },
    {
      type: "ul",
      marker: "check",
      items: [
        "**Flat-rate pricing** — $101 first 25 miles + $1.80/mile. Same rate regardless of vehicle type.",
        "**Real-time GPS tracking** — track all your vehicles on one dashboard.",
        "**Photo proof of condition** — protect yourself from damage claims.",
        "**Insurance included** — no extra fees. Full coverage from pickup to drop-off.",
        "**Bulk delivery discounts** — save 10-15% on high-volume accounts.",
        "**Dealer dashboard** — manage all your transports, drivers, and deliveries in one place.",
        "**Priority booking** — dealers get first access to available drivers.",
        "**No SUV/truck surcharge** — same rate for sedans, SUVs, trucks, vans.",
      ],
    },
    { type: "h2", text: "5 Common Dealership Vehicle Transport Scenarios" },
    { type: "h3", text: "1. Auction Purchases" },
    {
      type: "p",
      text: "Buying vehicles at auction? 101 Drivers picks up from major California auction houses (Manheim, Adesa, Copart, IAA) and delivers to your dealership. Get an instant quote, book in 2 minutes, and track your purchase in real-time. No more waiting for broker callbacks.",
    },
    { type: "h3", text: "2. Trade-In Vehicle Transport" },
    {
      type: "p",
      text: "When a customer trades in a vehicle, you often need to move it between lots or to a wholesale auction. 101 Drivers handles trade-in transport with photo documentation of condition — protecting you from disputes about pre-existing damage.",
    },
    { type: "h3", text: "3. Customer Home Delivery" },
    {
      type: "p",
      text: "Modern customers expect home delivery. With 101 Drivers, you can offer free or paid home delivery to your customers — we deliver their new vehicle to their driveway with photo proof and GPS tracking. Your customer gets a tracking link and you get delivery confirmation.",
    },
    { type: "h3", text: "4. Dealer-to-Dealer Transfers" },
    {
      type: "p",
      text: "Need to move inventory between your dealership locations or trade vehicles with another dealer? 101 Drivers handles dealer-to-dealer transfers across California with the same flat-rate pricing and real-time tracking.",
    },
    { type: "h3", text: "5. Inventory Repositioning" },
    {
      type: "p",
      text: "Sometimes you need to move vehicles between lots to balance inventory. 101 Drivers makes this fast and affordable — book a single vehicle or multiple vehicles in one batch through your dealer dashboard.",
    },
    { type: "h2", text: "How 101 Drivers Compares to National Brokers" },
    {
      type: "table",
      head: ["Feature", "101 Drivers", "National Brokers"],
      highlightCol: 1,
      rows: [
        ["Pricing model", "Flat rate", "Variable"],
        ["SUV/truck surcharge", "No", "Yes (10-20%)"],
        ["Insurance included", "Yes", "Often extra ($150-$300)"],
        ["Real-time GPS tracking", "Yes — all vehicles", "Usually no"],
        ["Photo proof of condition", "Yes", "Sometimes"],
        ["Bulk delivery discount", "10-15% off", "Varies"],
        ["Dealer dashboard", "Yes", "Some have it"],
        ["Booking time", "2 minutes", "15-60 minutes"],
        ["California knowledge", "Local expert", "National scope"],
      ],
    },
    { type: "h2", text: "How to Set Up a Dealership Account" },
    {
      type: "p",
      text: "Setting up a dealership account with 101 Drivers is free and takes 5 minutes:",
    },
    {
      type: "ol",
      items: [
        "Go to [101drivers.com/auth/dealer-signup](/auth/dealer-signup)",
        "Enter your dealership name, address, and contact info",
        "Verify your email address",
        "Submit your dealership license (DMV dealer license number)",
        "Get approved (usually within 24 hours)",
        "Start booking deliveries through your dealer dashboard",
      ],
    },
    { type: "p", text: "Once approved, you get immediate access to:" },
    {
      type: "ul",
      items: [
        "Bulk delivery pricing (10-15% off standard rates)",
        "Real-time dealer dashboard",
        "Priority booking — your deliveries get first access to drivers",
        "Direct customer support line",
        "Monthly billing (instead of per-delivery payment)",
        "Delivery history and reporting",
      ],
    },
    { type: "h2", text: "Dealership Pricing Example" },
    {
      type: "p",
      text: "Let's say your dealership needs to move 10 vehicles from an auction in LA to your lot in Orange County (about 50 miles):",
    },
    {
      type: "pricing",
      big: "$1,395",
      label: "10 vehicles, ~50 miles each (bulk)",
      rows: [
        { k: "Per vehicle (50 miles)", v: "$155" },
        { k: "10 vehicles × $155", v: "$1,550" },
        { k: "Bulk discount (10%)", v: "-$155", included: true },
        { k: "Total", v: "$1,395" },
      ],
    },
    {
      type: "p",
      text: "**Compare to national carriers:** The same 10-vehicle delivery would cost $2,500-$4,000 with national brokers, plus $1,500-$3,000 in insurance fees. **You save $2,600-$4,600 with 101 Drivers.**",
    },
    { type: "h2", text: "Frequently Asked Questions" },
    {
      type: "faq",
      items: [
        {
          q: "How much does dealership vehicle transport cost in California?",
          a: "Dealership vehicle transport costs in California depend on volume and distance. With 101 Drivers, single deliveries start at $101 for the first 25 miles + $1.80/mile. Dealerships that sign up for an account get bulk delivery discounts (10-15% off), a dashboard to manage all transports, and streamlined booking. Most dealerships save 20-30% vs. national carriers.",
        },
        {
          q: "How do I set up a dealership account with 101 Drivers?",
          a: "Setting up a dealership account is free and takes 5 minutes. Go to 101drivers.com/auth/dealer-signup, enter your dealership information, and verify your email. Once approved, you get a dealer dashboard, bulk delivery pricing, and priority booking.",
        },
        {
          q: "Can 101 Drivers handle bulk vehicle transport for dealerships?",
          a: "Yes. 101 Drivers works with automotive dealerships of all sizes — from single-location used car lots to multi-location new car franchises. We handle bulk deliveries, auction purchases, trade-ins, customer home deliveries, and dealer-to-dealer transfers. Contact us for custom pricing on high-volume accounts.",
        },
        {
          q: "Does 101 Drivers provide proof of vehicle condition for dealership inventory?",
          a: "Yes. 101 Drivers documents your vehicle's condition with photos at pickup, transit stops, and delivery. This protects your dealership from damage claims and provides documentation for your records. Every delivery includes a condition report and photo proof.",
        },
        {
          q: "Can I track multiple dealership vehicles in transit?",
          a: "Yes. Dealership accounts include a dashboard that shows all your in-transit vehicles on a single map. You can track every delivery in real-time, see ETAs, and receive delivery confirmations. No more calling dispatchers for status updates.",
        },
        {
          q: "What types of vehicles can 101 Drivers transport for dealerships?",
          a: "101 Drivers transports all types of vehicles including sedans, SUVs, trucks, vans, luxury vehicles, EVs, and classics. We do not charge SUV/truck surcharges like many national carriers — the same flat rate applies regardless of vehicle type.",
        },
        {
          q: "Does 101 Drivers offer home delivery for dealership customers?",
          a: "Yes. Many dealerships use 101 Drivers to deliver vehicles directly to their customers' homes. When a customer buys a car, you book delivery through your dealer dashboard, and we deliver the vehicle to their address with photo proof and GPS tracking.",
        },
      ],
    },
    { type: "h2", text: "Get Started with 101 Drivers for Your Dealership" },
    {
      type: "p",
      text: "If you're a California dealership looking for transparent, affordable vehicle transport with real-time tracking, 101 Drivers is your solution. Set up your free dealer account in 5 minutes and start saving 20-30% on every delivery.",
    },
  ],
};
