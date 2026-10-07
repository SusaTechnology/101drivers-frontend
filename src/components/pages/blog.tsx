import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { NavBar } from "../shared/layout/navbar";
import { SEOHead } from "../shared/SEOHead";
import { SiteFooter } from "../shared/SiteFooter";
import {
  ContentCard,
  ContentCardGrid,
} from "../shared/ContentCard";
import { ContentEmptyState } from "../shared/ContentEmptyState";
import { BLOG_POSTS } from "@/content/blog";
import { formatContentDate } from "@/lib/format-date";

/**
 * Blog index — renders a card for every post registered in
 * src/content/blog/. Adding a post (a new file + one line in that
 * folder's index.ts) automatically adds its card here and creates its
 * /blog/$slug detail page — nothing on this page is hard-coded per
 * post.
 */
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

        {/* Post cards — generated from the src/content/blog registry;
            empty registry renders the shared empty state */}
        <section>
          {BLOG_POSTS.length === 0 ? (
            <ContentEmptyState
              icon={BookOpen}
              title="No posts yet"
              description="We haven't published anything here yet — new guides and delivery-day breakdowns are on the way. Check back soon."
              actionTo="/"
              actionLabel="Get an instant quote"
            />
          ) : (
            <ContentCardGrid>
              {BLOG_POSTS.map((post) => (
                <ContentCard
                  key={post.slug}
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  title={post.title}
                  description={post.excerpt}
                  image={post.image}
                  imageAlt={post.imageAlt}
                  meta={[{ label: formatContentDate(post.date) }]}
                  fallbackIcon={BookOpen}
                  ctaLabel="Read article"
                />
              ))}
            </ContentCardGrid>
          )}
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
