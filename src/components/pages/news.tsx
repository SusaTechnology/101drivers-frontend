import { Link } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";

import { NavBar } from "../shared/layout/navbar";
import { SEOHead } from "../shared/SEOHead";
import { SiteFooter } from "../shared/SiteFooter";

/**
 * News page — TEST/SAMPLE content. The owner asked for placeholder pages;
 * replace the sample posts below with real announcements (or wire them to
 * the admin CMS) when ready.
 */
const SAMPLE_NEWS = [
  {
    date: "September 18, 2026",
    tag: "Service Update",
    title: "Same-day delivery windows now bookable across Greater Los Angeles",
    paragraphs: [
      "Customers can now request same-day pickup windows directly from the quote flow. When a qualified driver is nearby, the request is offered instantly instead of waiting for the next-day dispatch cycle.",
      "Same-day availability depends on driver supply in your service district at the time of booking. The quote screen always shows the earliest realistic pickup window before you confirm.",
    ],
  },
  {
    date: "August 30, 2026",
    tag: "Product",
    title: "Proof-of-delivery reports get richer photos and clearer timelines",
    paragraphs: [
      "Delivery reports now group every GPS-stamped photo — pickup inspection, odometer, VIN, and drop-off — into a single timeline that is easier to scan and share with your team.",
      "Dealers reviewing multiple deliveries per day will find the report layout familiar: same sections, better ordering, no change to how disputes or claims are filed.",
    ],
  },
  {
    date: "July 22, 2026",
    tag: "Company",
    title: "Driver onboarding is now fully in-app, start to finish",
    paragraphs: [
      "New drivers can complete the entire onboarding flow — documents, vehicle details, and verification — without emailing anything to support. Status updates arrive by email at every step.",
      "Existing drivers are not affected. If you started onboarding before this change, simply continue where you left off; the app will carry your progress over.",
    ],
  },
];

function NewsPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <SEOHead
        title="News | 101 Drivers — California Vehicle Delivery"
        description="Product updates, service changes, and company announcements from 101 Drivers — California's flat-rate vehicle pickup and delivery service."
        canonicalUrl="https://101drivers.com/news"
        schema={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "101 Drivers News",
          url: "https://101drivers.com/news",
        }}
      />
      <NavBar />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Hero */}
        <section className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 w-fit mb-4">
            <Newspaper className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-300">
              News &amp; Updates
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
            News
          </h1>
          <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            Product updates, service changes, and announcements from the 101
            Drivers team.
          </p>
        </section>

        {/* Test posts — replace with real content */}
        <section className="space-y-6">
          {SAMPLE_NEWS.map((post) => (
            <article
              key={post.title}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8"
            >
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-lime-500/15 text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-lime-400">
                  {post.tag}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {post.date}
                </span>
              </div>
              <h2 className="text-lg lg:text-xl font-black text-slate-900 dark:text-white">
                {post.title}
              </h2>
              <div className="mt-3 space-y-3">
                {post.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>

        {/* Cross-link */}
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-10">
          Questions about a change?{" "}
          <Link
            to="/help-customer"
            className="font-bold text-slate-900 dark:text-white hover:text-lime-500 transition-colors"
          >
            Contact us
          </Link>{" "}
          — we reply fast.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

export default NewsPage;
