import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { NavBar } from "../shared/layout/navbar";
import { SEOHead } from "../shared/SEOHead";
import { SiteFooter } from "../shared/SiteFooter";

/**
 * Blog page — TEST/SAMPLE content. The owner asked for placeholder pages;
 * replace the sample posts below with real articles (or wire them to the
 * admin CMS) when ready.
 */
const SAMPLE_POSTS = [
  {
    date: "September 5, 2026",
    title: "How our flat-rate pricing works",
    paragraphs: [
      "Every quote on 101 Drivers is flat-rate: the price you see is the price you pay, regardless of the traffic, the route the driver takes, or how many tolls show up on the way.",
      "The rate is built from the pickup and drop-off zones, the vehicle type, and the service level you choose. Because drivers see the full route and payout before accepting a job, nobody renegotiates mid-delivery — that is the whole point.",
      "If anything about your quote looks off, contact us before confirming. Changing a booked delivery later can change the price; changing it before booking never does.",
    ],
  },
  {
    date: "August 14, 2026",
    title: "5 things to check before handing over your keys",
    paragraphs: [
      "First: remove personal belongings from the cabin and trunk. Drivers photograph the interior state at pickup, but loose items cannot be insured.",
      "Second: have the registration and insurance documents accessible. Third: note your fuel and odometer readings — the driver records them too, and matching records make any later dispute trivial.",
      "Fourth: ensure there is a working key or fob for the car — rekeying delays are the most common cause of same-day cancellations. Fifth: if someone else is at the pickup location, share the delivery PIN with them in advance so the driver can verify authorization.",
    ],
  },
  {
    date: "July 9, 2026",
    title: "What happens between pickup and drop-off",
    paragraphs: [
      "Once the driver enters the last four digits of the VIN, live tracking starts. Every material event — inspection photos, route progress, arrival — is stamped with GPS coordinates and time.",
      "You can follow the delivery from the public tracking link or your dashboard. If a delivery is ever late, the tracking page is the first place the new ETA appears.",
      "At drop-off the driver repeats the inspection: photos of the car, final odometer reading, and keys handed to the authorized person. You receive the full report by email within minutes.",
    ],
  },
];

function BlogPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <SEOHead
        title="Blog | 101 Drivers — California Vehicle Delivery"
        description="Guides and insights from 101 Drivers: flat-rate pricing, delivery-day checklists, and how documented vehicle transport works across California."
        canonicalUrl="https://101drivers.com/blog"
        schema={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "101 Drivers Blog",
          url: "https://101drivers.com/blog",
        }}
      />
      <NavBar />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Hero */}
        <section className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 w-fit mb-4">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Blog
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
            Blog
          </h1>
          <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            Guides and insights on how documented, flat-rate vehicle delivery
            works — written by the team that runs it every day.
          </p>
        </section>

        {/* Test posts — replace with real content */}
        <section className="space-y-6">
          {SAMPLE_POSTS.map((post) => (
            <article
              key={post.title}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8"
            >
              <span className="text-xs text-slate-400 font-medium">
                {post.date}
              </span>
              <h2 className="text-lg lg:text-xl font-black text-slate-900 dark:text-white mt-2">
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
          Ready to move a car?{" "}
          <Link
            to="/"
            className="font-bold text-slate-900 dark:text-white hover:text-lime-500 transition-colors"
          >
            Get an instant quote
          </Link>{" "}
          — no upfront fees.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

export default BlogPage;
