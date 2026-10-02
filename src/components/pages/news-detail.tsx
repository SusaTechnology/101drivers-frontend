import { Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Newspaper } from "lucide-react";

import { NavBar } from "../shared/layout/navbar";
import { SEOHead } from "../shared/SEOHead";
import { PublicFooter } from "../shared/PublicFooter";
import { ContentNotFound } from "../shared/ContentNotFound";
import { getNewsPost } from "@/content/news";
import { formatContentDate } from "@/lib/format-date";

/**
 * News announcement — /news/$slug. The post comes from the
 * src/content/news registry; unknown slugs render a friendly not-found
 * state (an SPA serves index.html for every path, so 404s are handled
 * in-page).
 */
export default function NewsDetailPage({ slug }: { slug: string }) {
  const post = getNewsPost(slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <SEOHead
          title="Announcement not found | 101 Drivers"
          description="This news announcement could not be found."
          canonicalUrl={`https://101drivers.com/news/${slug}`}
        />
        <NavBar />
        <ContentNotFound label="announcement" backTo="/news" backLabel="Back to news" />
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <SEOHead
        title={`${post.title} | 101 Drivers News`}
        description={post.excerpt}
        canonicalUrl={`https://101drivers.com/news/${post.slug}`}
        ogType="article"
        ogImage={
          post.image ? `https://101drivers.com${post.image}` : undefined
        }
        ogImageAlt={post.imageAlt}
        schema={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: post.title,
          description: post.excerpt,
          datePublished: post.date,
          url: `https://101drivers.com/news/${post.slug}`,
          image: post.image ? `https://101drivers.com${post.image}` : undefined,
          publisher: {
            "@type": "Organization",
            name: "101 Drivers Inc.",
            url: "https://101drivers.com",
          },
        }}
      />
      <NavBar />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <article className="max-w-3xl mx-auto">
          {/* Back to the index */}
          <Link
            to="/news"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All news
          </Link>

          {/* Cover */}
          {post.image && (
            <img
              src={post.image}
              alt={post.imageAlt ?? ""}
              className="mt-6 aspect-video w-full rounded-2xl object-cover border border-slate-200 dark:border-slate-800"
            />
          )}

          {/* Header */}
          <header className="mt-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-lime-500/15 text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-lime-400">
                {post.tag}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                {formatContentDate(post.date)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
                News
              </span>
            </div>
            <h1 className="mt-3 text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight">
              {post.title}
            </h1>
            <p className="mt-4 text-sm lg:text-base font-medium text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-lime-500 pl-4">
              {post.excerpt}
            </p>
          </header>

          {/* Body */}
          <div className="mt-8 space-y-4">
            {post.body.map((paragraph, i) => (
              <p
                key={i}
                className="text-sm lg:text-base text-slate-600 dark:text-slate-400 leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </div>

          {/* Cross-link */}
          <div className="mt-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Questions about a change?{" "}
              <Link
                to="/help-customer"
                className="font-bold text-slate-900 dark:text-white hover:text-lime-500 transition-colors"
              >
                Contact us
              </Link>{" "}
              — we reply fast.
            </p>
            <Link
              to="/news"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              More news
            </Link>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
