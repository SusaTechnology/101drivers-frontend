import { Link } from "@tanstack/react-router";
import { ArrowLeft, Briefcase, MapPin } from "lucide-react";

import { NavBar } from "../shared/layout/navbar";
import { SEOHead } from "../shared/SEOHead";
import { PublicFooter } from "../shared/PublicFooter";
import { ContentNotFound } from "../shared/ContentNotFound";
import { getJobPosting } from "@/content/careers";

/**
 * Job posting — /careers/$slug. The role comes from the
 * src/content/careers registry; unknown slugs render a friendly
 * not-found state (an SPA serves index.html for every path, so 404s
 * are handled in-page).
 *
 * The Apply flow routes to the support inbox already used across the
 * site (mailto with a pre-filled subject per role).
 */
export default function CareerDetailPage({ slug }: { slug: string }) {
  const role = getJobPosting(slug);

  if (!role) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <SEOHead
          title="Role not found | 101 Drivers"
          description="This job posting could not be found."
          canonicalUrl={`https://101drivers.com/careers/${slug}`}
        />
        <NavBar />
        <ContentNotFound label="job posting" backTo="/careers" backLabel="Back to careers" />
        <PublicFooter />
      </div>
    );
  }

  const applyMailto = `mailto:${role.applyEmail}?subject=${encodeURIComponent(
    `Application: ${role.title}`,
  )}`;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <SEOHead
        title={`${role.title} | 101 Drivers Careers`}
        description={role.excerpt}
        canonicalUrl={`https://101drivers.com/careers/${role.slug}`}
        schema={{
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: role.title,
          description: role.body.join(" "),
          employmentType: role.employmentType,
          url: `https://101drivers.com/careers/${role.slug}`,
          hiringOrganization: {
            "@type": "Organization",
            name: "101 Drivers Inc.",
            url: "https://101drivers.com",
          },
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressRegion: "CA",
              addressCountry: "US",
            },
          },
        }}
      />
      <NavBar />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <article className="max-w-3xl mx-auto">
          {/* Back to the index */}
          <Link
            to="/careers"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All roles
          </Link>

          {/* Header */}
          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-lime-500/15 text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-lime-400">
                {role.type}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {role.location}
              </span>
            </div>
            <h1 className="mt-3 text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight">
              {role.title}
            </h1>
            <p className="mt-4 text-sm lg:text-base font-medium text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-lime-500 pl-4">
              {role.excerpt}
            </p>
          </header>

          {/* Body */}
          <div className="mt-8 space-y-4">
            {role.body.map((paragraph, i) => (
              <p
                key={i}
                className="text-sm lg:text-base text-slate-600 dark:text-slate-400 leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </div>

          {/* Apply */}
          <section className="mt-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
              <Briefcase className="h-4 w-4 text-lime-600 dark:text-lime-400" aria-hidden="true" />
              How to apply
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Applications are reviewed within a few days. You will always
              hear back, one way or the other.
            </p>
            <a
              href={applyMailto}
              className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-lime-500 hover:bg-lime-600 text-slate-950 text-xs font-black uppercase tracking-wider transition-colors"
            >
              Apply for this role
            </a>
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              101 Drivers Inc. is an equal opportunity employer.
            </p>
          </section>

          <Link
            to="/careers"
            className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            More roles
          </Link>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
