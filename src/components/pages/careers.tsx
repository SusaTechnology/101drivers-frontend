import { Briefcase, MapPin, Clock, HeartHandshake } from "lucide-react";

import { NavBar } from "../shared/layout/navbar";
import { SEOHead } from "../shared/SEOHead";
import { SiteFooter } from "../shared/SiteFooter";

/**
 * Careers page — TEST/SAMPLE content. The owner asked for placeholder
 * pages; replace the sample roles below with real openings when ready.
 * Apply buttons route to the support inbox already used across the site
 * (support@101drivers.com).
 */
const WHY_SECTIONS = [
  {
    icon: Briefcase,
    title: "Real work, real routes",
    description:
      "Every role here supports real deliveries moving across California every day — no filler projects.",
  },
  {
    icon: Clock,
    title: "Fast decisions",
    description:
      "Applications are reviewed within a few days. You will always hear back, one way or the other.",
  },
  {
    icon: HeartHandshake,
    title: "Support that shows up",
    description:
      "The same fast, direct support we give customers and drivers is what you get as a teammate.",
  },
];

const SAMPLE_ROLES = [
  {
    title: "Delivery Driver (Independent Contractor)",
    location: "Greater Los Angeles, CA",
    type: "Contractor",
    description:
      "Drive different cars from one location to another across the LA area. Pick your own jobs, see the route and pay before you accept, and get paid weekly. Requires an eligible vehicle, a clean record, and completed in-app onboarding.",
  },
  {
    title: "Operations Coordinator",
    location: "Greater Los Angeles, CA",
    type: "Full-time",
    description:
      "Keep daily dispatch running smoothly: monitor active deliveries, help drivers and customers unblock issues, and flag patterns the product team should fix. Strong communication and calm-under-pressure are must-haves.",
  },
  {
    title: "Customer Support Specialist",
    location: "Remote (California)",
    type: "Part-time",
    description:
      "Own the WhatsApp and email queues: answer quote questions, delivery status checks, and post-delivery reports. You are the voice customers quote back at us — write like a human, resolve like a pro.",
  },
];

function CareersPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <SEOHead
        title="Careers | 101 Drivers — California Vehicle Delivery"
        description="Join 101 Drivers. Open roles in operations, support, and independent contractor driving across Greater Los Angeles, California."
        canonicalUrl="https://101drivers.com/careers"
        schema={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "101 Drivers Careers",
          url: "https://101drivers.com/careers",
        }}
      />
      <NavBar />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Hero */}
        <section className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 w-fit mb-4">
            <Briefcase className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Careers
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
            Careers at 101 Drivers
          </h1>
          <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            We are a small California-only team moving cars for dealerships and
            individuals — with documented proof at every step. Want to help
            build it? Below are the roles we are hiring for right now.
          </p>
        </section>

        {/* Why */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {WHY_SECTIONS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <div className="w-10 h-10 rounded-xl bg-lime-500/15 flex items-center justify-center mb-3">
                <Icon className="h-5 w-5 text-lime-600 dark:text-lime-400" />
              </div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                {title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </section>

        {/* Open roles — sample content */}
        <section>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">
            Open roles
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Sample listings — contact us even if your role is not listed.
          </p>
          <div className="space-y-4">
            {SAMPLE_ROLES.map((role) => (
              <article
                key={role.title}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {role.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {role.location}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {role.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-3">
                      {role.description}
                    </p>
                  </div>
                  <a
                    href={`mailto:support@101drivers.com?subject=${encodeURIComponent(
                      `Application: ${role.title}`,
                    )}`}
                    className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-600 text-slate-950 text-xs font-black uppercase tracking-wider transition-colors"
                  >
                    Apply
                  </a>
                </div>
              </article>
            ))}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-6 leading-relaxed">
            101 Drivers Inc. is an equal opportunity employer. Independent
            contractor driving is not employment — drivers join through the
            in-app onboarding flow instead of this page.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default CareersPage;
