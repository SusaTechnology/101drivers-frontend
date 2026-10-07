import { Link } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";

import { NavBar } from "../shared/layout/navbar";
import { SEOHead } from "../shared/SEOHead";
import { SiteFooter } from "../shared/SiteFooter";
import {
  ContentCard,
  ContentCardGrid,
} from "../shared/ContentCard";
import { ContentEmptyState } from "../shared/ContentEmptyState";
import { NEWS_POSTS } from "@/content/news";
import { formatContentDate } from "@/lib/format-date";

/**
 * News index — renders a card for every announcement registered in
 * src/content/news/. Adding an announcement (a new file + one line in
 * that folder's index.ts) automatically adds its card here and creates
 * its /news/$slug detail page — nothing on this page is hard-coded per
 * post.
 */
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

        {/* Announcement cards — generated from the src/content/news
            registry; empty registry renders the shared empty state */}
        <section>
          {NEWS_POSTS.length === 0 ? (
            <ContentEmptyState
              icon={Newspaper}
              title="No announcements yet"
              description="There is nothing new to share right now. Updates will appear here as they happen."
              actionTo="/help-customer"
              actionLabel="Contact us"
            />
          ) : (
            <ContentCardGrid>
              {NEWS_POSTS.map((post) => (
                <ContentCard
                  key={post.slug}
                  to="/news/$slug"
                  params={{ slug: post.slug }}
                  title={post.title}
                  description={post.excerpt}
                  image={post.image}
                  imageAlt={post.imageAlt}
                  badge={post.tag}
                  meta={[{ label: formatContentDate(post.date) }]}
                  fallbackIcon={Newspaper}
                  ctaLabel="Read update"
                />
              ))}
            </ContentCardGrid>
          )}
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
