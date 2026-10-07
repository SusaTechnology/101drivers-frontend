import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Phone,
  User,
  XCircle,
} from "lucide-react";

import { NavBar } from "../shared/layout/navbar";
import { SEOHead } from "../shared/SEOHead";
import { SiteFooter } from "../shared/SiteFooter";
import { ContentNotFound } from "../shared/ContentNotFound";
import { getBlogPost } from "@/content/blog";
import { formatContentDate } from "@/lib/format-date";
import type { BlogBlock } from "@/content/types";

/**
 * Blog article — /blog/$slug. The post comes from the src/content/blog
 * registry (rich blocks: paragraphs, headings, lists, callouts, tables,
 * pricing cards, FAQs, chips, related links); unknown slugs render a
 * friendly not-found state (an SPA serves index.html for every path, so
 * 404s are handled in-page).
 *
 * SEO: BlogPosting JSON-LD for every post, plus FAQPage and
 * BreadcrumbList when the post contains FAQs.
 */

/** Inline formatting: `**bold**` and `[label](/path)` — React nodes
 *  only, never raw HTML. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-bold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        nodes.push(
          <Link
            key={key++}
            to={link[2] as LinkProps["to"]}
            className="font-bold text-lime-600 dark:text-lime-400 hover:underline"
          >
            {link[1]}
          </Link>,
        );
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const CELL = "p-4 border-b border-slate-200 dark:border-slate-800 align-top";

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          {renderInline(block.text)}
        </p>
      );
    case "h2":
      return (
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-4">
          {renderInline(block.text)}
        </h2>
      );
    case "h3":
      return (
        <h3 className="text-lg font-black text-slate-900 dark:text-white mt-8 mb-3">
          {renderInline(block.text)}
        </h3>
      );
    case "ul":
      return (
        <ul className="list-disc list-inside text-sm lg:text-base text-slate-600 dark:text-slate-300 mb-6 space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className={block.marker ? "flex items-start gap-2 list-none -ml-1" : ""}>
              {block.marker === "check" && (
                <CheckCircle2 className="w-4 h-4 text-lime-500 shrink-0 mt-1" aria-hidden="true" />
              )}
              {block.marker === "cross" && (
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-1" aria-hidden="true" />
              )}
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal list-inside text-sm lg:text-base text-slate-600 dark:text-slate-300 mb-6 space-y-2">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <div className="bg-lime-50 dark:bg-lime-500/10 border-l-4 border-lime-500 p-6 mb-8 rounded-r-lg">
          <p className="text-sm lg:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
            {block.label && (
              <strong className="font-bold text-slate-900 dark:text-white">
                {block.label}{" "}
              </strong>
            )}
            {renderInline(block.text)}
          </p>
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto mb-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                {block.head.map((cell, i) => (
                  <th
                    key={i}
                    className={`p-4 text-left font-bold border-b-2 border-slate-200 dark:border-slate-700 ${
                      block.highlightCol === i
                        ? "text-lime-600 dark:text-lime-400"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr
                  key={r}
                  className={
                    block.highlightRow === r
                      ? "bg-lime-50 dark:bg-lime-500/10"
                      : r % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-800/50"
                  }
                >
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={`${CELL} ${
                        block.highlightCol === c || block.highlightRow === r
                          ? "font-bold text-lime-700 dark:text-lime-400"
                          : c === 0
                            ? "font-medium text-slate-900 dark:text-white"
                            : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.note && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {block.note}
            </p>
          )}
        </div>
      );
    case "pricing":
      return (
        <div className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="text-center mb-4">
            <div className="text-4xl font-black text-slate-900 dark:text-white">
              {block.big}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{block.label}</p>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
            {block.rows.map((row, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{row.k}</span>
                <span
                  className={`font-bold ${
                    row.included
                      ? "text-lime-600 dark:text-lime-400"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {row.v}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    case "faq":
      return (
        <div className="space-y-4 mb-8">
          {block.items.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
            >
              <h3 className="font-bold text-base mb-2 text-slate-900 dark:text-white">
                {faq.q}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {renderInline(faq.a)}
              </p>
            </div>
          ))}
        </div>
      );
    case "chips":
      return (
        <div className="grid grid-cols-2 gap-2 mb-8">
          {block.items.map((area) => (
            <div
              key={area}
              className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded text-sm text-slate-700 dark:text-slate-300"
            >
              <CheckCircle2 className="w-4 h-4 text-lime-500 shrink-0" aria-hidden="true" />
              {area}
            </div>
          ))}
        </div>
      );
    case "related":
      return (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {block.items.map((item) => (
            <Link
              key={item.label}
              to={item.to as LinkProps["to"]}
              className="block p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2 text-lime-600 dark:text-lime-400 font-medium mb-1">
                {item.label}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      );
  }
}

export default function BlogDetailPage({ slug }: { slug: string }) {
  const post = getBlogPost(slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <SEOHead
          title="Post not found | 101 Drivers"
          description="This blog post could not be found."
          canonicalUrl={`https://101drivers.com/blog/${slug}`}
        />
        <NavBar />
        <ContentNotFound label="blog post" backTo="/blog" backLabel="Back to the blog" />
        <SiteFooter />
      </div>
    );
  }

  const postUrl = `https://101drivers.com/blog/${post.slug}`;
  const faqs = post.body.flatMap((b) => (b.type === "faq" ? b.items : []));
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      datePublished: post.date,
      url: postUrl,
      image: post.image ? `https://101drivers.com${post.image}` : undefined,
      author: { "@type": "Organization", name: "101 Drivers", url: "https://101drivers.com" },
      publisher: {
        "@type": "Organization",
        name: "101 Drivers Inc.",
        url: "https://101drivers.com",
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    },
  ];
  if (faqs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  schemas.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://101drivers.com/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://101drivers.com/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: postUrl },
    ],
  });

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <SEOHead
        title={`${post.title} | 101 Drivers Blog`}
        description={post.excerpt}
        canonicalUrl={postUrl}
        ogType="article"
        ogImage={
          post.image ? `https://101drivers.com${post.image}` : undefined
        }
        ogImageAlt={post.imageAlt}
        schema={schemas}
      />
      <NavBar />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <article className="max-w-3xl mx-auto">
          {/* Back to the index */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All posts
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                {formatContentDate(post.date)}
              </span>
              {post.readingMinutes && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {post.readingMinutes} min read
                </span>
              )}
              {post.author && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  {post.author}
                </span>
              )}
              {post.kicker && (
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  {post.kicker}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight">
              {post.title}
            </h1>
            <p className="mt-4 text-sm lg:text-base font-medium text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-lime-500 pl-4">
              {post.excerpt}
            </p>
          </header>

          {/* Body — rendered from the registry blocks */}
          <div className="mt-8 space-y-4">
            {post.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 rounded-2xl bg-lime-500 p-8 text-center">
            <h2 className="text-2xl font-black text-white mb-2">
              Ready to Book Your Car Delivery?
            </h2>
            <p className="text-lime-50 text-sm mb-6">
              Get an instant flat-rate quote. No account required. Book in 2
              minutes.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-xs font-black uppercase tracking-wider text-lime-600 hover:bg-slate-100 transition-colors"
              >
                Get Instant Quote
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="tel:+14243132168"
                className="inline-flex items-center gap-2 rounded-xl border border-white px-6 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-white hover:text-lime-600 transition-colors"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                (424) 313-2168
              </a>
            </div>
          </div>

          <Link
            to="/blog"
            className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            More posts
          </Link>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
