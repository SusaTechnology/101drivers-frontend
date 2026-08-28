import { useEffect } from 'react'

export interface SEOHeadProps {
  title?: string
  description?: string
  canonicalUrl?: string
  ogType?: string
  ogImage?: string
  ogImageAlt?: string
  twitterCard?: 'summary' | 'summary_large_image'
  schema?: Record<string, unknown> | Array<Record<string, unknown>>
  noindex?: boolean
}

const DEFAULT_TITLE = '101 Drivers — Car Pickup & Delivery Service in California | Flat Rate'
const DEFAULT_DESCRIPTION =
  "California's flat-rate car pickup & delivery service. Dealers & individuals get instant quotes, real-time GPS tracking, and insured vehicle transport across Southern California. Santa Monica to LA & beyond."
const DEFAULT_IMAGE = 'https://101drivers.com/assets/101drivers-logo.jpg'
const DEFAULT_IMAGE_ALT = '101 Drivers — Flat-rate vehicle delivery service in California'
const BASE_URL = 'https://101drivers.com'

function setOrCreateMeta(selector: string, attributeName: string, attributeValue: string, content: string) {
  let element = document.querySelector(selector) as HTMLMetaElement | null
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attributeName, attributeValue)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function setOrCreateLink(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.appendChild(element)
  }
  element.href = href
}

export function SEOHead({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonicalUrl,
  ogType = 'website',
  ogImage = DEFAULT_IMAGE,
  ogImageAlt = DEFAULT_IMAGE_ALT,
  twitterCard = 'summary_large_image',
  schema,
  noindex = false,
}: SEOHeadProps) {
  useEffect(() => {
    // 1. Update Title
    document.title = title

    // 2. Meta description & title
    setOrCreateMeta('meta[name="description"]', 'name', 'description', description)
    setOrCreateMeta('meta[name="title"]', 'name', 'title', title)

    // 3. Robots meta (if explicitly requested noindex)
    if (noindex) {
      setOrCreateMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow')
    }

    // 4. Canonical URL
    const canonical =
      canonicalUrl ||
      (typeof window !== 'undefined'
        ? `${BASE_URL}${window.location.pathname === '/home' ? '/' : window.location.pathname}`
        : BASE_URL)
    setOrCreateLink('canonical', canonical)

    // 5. Open Graph
    setOrCreateMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setOrCreateMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setOrCreateMeta('meta[property="og:type"]', 'property', 'og:type', ogType)
    setOrCreateMeta('meta[property="og:url"]', 'property', 'og:url', canonical)
    setOrCreateMeta('meta[property="og:image"]', 'property', 'og:image', ogImage)
    setOrCreateMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', ogImageAlt)
    setOrCreateMeta('meta[property="og:site_name"]', 'property', 'og:site_name', '101 Drivers')

    // 6. Twitter Cards
    setOrCreateMeta('meta[name="twitter:card"]', 'name', 'twitter:card', twitterCard)
    setOrCreateMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    setOrCreateMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
    setOrCreateMeta('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage)

    // 7. Schema.org JSON-LD (dynamic injection)
    const scriptId = 'seo-dynamic-json-ld'
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null

    if (schema) {
      if (!scriptEl) {
        scriptEl = document.createElement('script')
        scriptEl.id = scriptId
        scriptEl.type = 'application/ld+json'
        document.head.appendChild(scriptEl)
      }
      scriptEl.textContent = JSON.stringify(schema)
    } else if (scriptEl) {
      scriptEl.remove()
    }
  }, [title, description, canonicalUrl, ogType, ogImage, ogImageAlt, twitterCard, schema, noindex])

  return null
}
