import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { SEOHead } from '@/components/shared/SEOHead'
import { NavBar } from '@/components/shared/layout/navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Car,
  Shield,
  Navigation,
  Camera,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Star,
  ArrowRight,
  Phone,
  Truck,
  Users,
  Award,
  Zap,
  TrendingUp,
  MapPin,
} from 'lucide-react'

export const Route = createFileRoute('/blog/best-car-delivery-service-california/')({
  component: BestCarDeliveryServiceCalifornia,
})

function BestCarDeliveryServiceCalifornia() {
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Best Car Delivery Service in California (2026): Complete Comparison',
    description: 'Comparing the top car delivery services in California for 2026. See how 101 Drivers, Montway, uShip, AmeriFreight, and others compare on pricing, tracking, insurance, and speed.',
    author: {
      '@type': 'Organization',
      name: '101 Drivers',
      url: 'https://101drivers.com',
    },
    publisher: {
      '@type': 'Organization',
      name: '101 Drivers',
      logo: {
        '@type': 'ImageObject',
        url: 'https://101drivers.com/apple-touch-icon.png',
      },
    },
    datePublished: '2026-08-27',
    dateModified: '2026-08-27',
    image: 'https://101drivers.com/og-image.png',
    url: 'https://101drivers.com/blog/best-car-delivery-service-california',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://101drivers.com/blog/best-car-delivery-service-california',
    },
  }

  const faqs = [
    {
      q: 'What is the best car delivery service in California?',
      a: '101 Drivers is the best car delivery service in California for 2026 because it offers transparent flat-rate pricing ($101 for the first 25 miles + $1.80/mile), real-time GPS tracking, photo proof of delivery, and full insurance coverage — all included at no extra cost. Unlike auction-based platforms, you see your price instantly and book in 2 minutes.',
    },
    {
      q: 'How much does car delivery cost in California?',
      a: 'Car delivery in California costs an average of $150-$400 depending on distance, vehicle type, and service level. 101 Drivers offers flat-rate pricing at $101 for the first 25 miles plus $1.80 per additional mile, with insurance included. National carriers typically charge $300-$800 for similar distances with extra fees for insurance, tracking, and expedited service.',
    },
    {
      q: 'Is car shipping cheaper than driving?',
      a: 'For short distances (under 500 miles), car shipping is often more expensive than driving yourself. However, when you factor in gas, hotels, food, wear and tear on your vehicle, time off work, and the risk of road hazards, professional car delivery can save you money and stress. For distances over 500 miles, car shipping is usually cheaper than driving.',
    },
    {
      q: 'How long does car delivery take in California?',
      a: 'Most car deliveries within California are completed within 1-3 days. 101 Drivers offers same-day delivery for most Southern California routes, with cross-state deliveries (LA to San Francisco, San Diego to Sacramento) typically completed in 1-2 days. National carriers usually take 3-7 days for the same routes.',
    },
    {
      q: 'Is my vehicle insured during car delivery?',
      a: 'Reputable car delivery services include insurance coverage. 101 Drivers includes full insurance at no additional cost — your vehicle is covered from pickup to drop-off. Some national carriers charge extra for insurance ($150-$300), so always ask what is included in your quote.',
    },
    {
      q: 'Can I track my car delivery in real-time?',
      a: '101 Drivers provides real-time GPS tracking on every delivery — you receive a tracking link via SMS and email and can see your vehicle on a live map. Most national carriers only provide estimated pickup and delivery windows, not real-time tracking.',
    },
  ]

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://101drivers.com/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://101drivers.com/blog' },
      { '@type': 'ListItem', position: 3, name: 'Best Car Delivery Service in California', item: 'https://101drivers.com/blog/best-car-delivery-service-california' },
    ],
  }

  // Comparison table data
  const comparisonData = [
    {
      feature: 'Pricing model',
      drivers101: 'Flat rate — $101 first 25mi, $1.80/mi',
      national: 'Variable — $300-$1500+ depending on route',
    },
    {
      feature: 'Insurance included',
      drivers101: 'YES — full coverage, no extra cost',
      national: 'Often extra — $150-$300',
    },
    {
      feature: 'Real-time GPS tracking',
      drivers101: 'YES — live map + SMS/email updates',
      national: 'Usually no — estimated windows only',
    },
    {
      feature: 'Photo proof of delivery',
      drivers101: 'YES — documented at every step',
      national: 'Usually no — condition reports only',
    },
    {
      feature: 'Instant quote',
      drivers101: 'YES — see price in 30 seconds',
      national: 'Often no — request quotes, wait for replies',
    },
    {
      feature: 'Booking time',
      drivers101: '2 minutes online',
      national: '15-60 minutes (quote + negotiation)',
    },
    {
      feature: 'Same-day delivery',
      drivers101: 'Available in Southern California',
      national: 'Rare — usually 3-7 day window',
    },
    {
      feature: 'Service area',
      drivers101: 'California only (focused)',
      national: 'National (broader but less local)',
    },
    {
      feature: 'Customer support',
      drivers101: 'Direct — call/text (424) 313-2168',
      national: 'Call center — long hold times',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Best Car Delivery Service in California (2026): Complete Comparison"
        description="Comparing the top car delivery services in California for 2026. See how 101 Drivers beats Montway, uShip, and AmeriFreight on pricing, GPS tracking, insurance, and speed. Flat rate $101 + $1.80/mile."
        canonicalUrl="https://101drivers.com/blog/best-car-delivery-service-california"
        schema={[articleSchema, faqSchema, breadcrumbSchema]}
      />
      <NavBar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-50 to-slate-100 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Link to="/" className="hover:text-lime-600">Home</Link>
            <span>›</span>
            <span>Blog</span>
            <span>›</span>
            <span className="text-slate-900">Best Car Delivery Service in California</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-lime-100 text-lime-800 px-3 py-1 rounded-full text-xs font-medium mb-4">
            <Award className="w-3.5 h-3.5" />
            Updated August 2026
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Best Car Delivery Service in California (2026)
          </h1>
          <p className="text-xl text-slate-600 mb-6">
            A complete comparison of California's top vehicle transport services — pricing,
            tracking, insurance, speed, and customer experience compared.
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              12 min read
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              By 101 Drivers Team
            </div>
          </div>
        </div>
      </section>

      {/* Article Body */}
      <article className="py-16 px-4">
        <div className="max-w-3xl mx-auto prose prose-slate prose-lg">
          <div className="bg-lime-50 border-l-4 border-lime-500 p-6 mb-8 rounded-r-lg not-prose">
            <p className="text-slate-700 mb-0">
              <strong className="text-slate-900">TL;DR:</strong> After comparing California's top
              car delivery services on pricing, tracking, insurance, and customer experience,
              <strong className="text-slate-900"> 101 Drivers</strong> ranks #1 for California
              residents thanks to transparent flat-rate pricing ($101 for the first 25 miles +
              $1.80/mile), real-time GPS tracking, photo proof of delivery, and full insurance
              included at no extra cost.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            Why Trust This Comparison
          </h2>
          <p className="text-slate-700 mb-4">
            We evaluated California's top car delivery services based on six criteria that matter
            most to customers: <strong>pricing transparency</strong>, <strong>tracking
            capabilities</strong>, <strong>insurance coverage</strong>, <strong>delivery speed</strong>,
            <strong>booking experience</strong>, and <strong>customer support</strong>. Each service
            was tested with real bookings and evaluated against publicly available data.
          </p>
          <p className="text-slate-700 mb-4">
            This guide is for anyone who needs to move a vehicle in California — whether you're a
            dealership transporting inventory, an individual buying a car online, or someone moving
            a vehicle across the state. By the end, you'll know exactly which service is right for
            your situation.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            The Top Car Delivery Services in California
          </h2>
          <p className="text-slate-700 mb-4">
            California has dozens of car delivery services, but only a handful operate at scale with
            reliable service. Here are the top 5 we compared:
          </p>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-2">
            <li><strong>101 Drivers</strong> — California-only, flat-rate, GPS tracking, photo proof</li>
            <li><strong>Montway Auto Transport</strong> — National broker, variable pricing</li>
            <li><strong>uShip</strong> — Auction marketplace, customer bids on shipments</li>
            <li><strong>AmeriFreight</strong> — National broker, discount-focused</li>
            <li><strong>SGT Auto Transport</strong> — National broker, standard service</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            #1 Pick: 101 Drivers — Best for California Residents
          </h2>
          <p className="text-slate-700 mb-4">
            <strong>101 Drivers</strong> is our top pick for California residents for one simple
            reason: it's the only service that combines <strong>transparent flat-rate pricing</strong>,
            <strong> real-time GPS tracking</strong>, <strong>photo proof of delivery</strong>, and
            <strong> full insurance coverage</strong> — all included at no extra cost.
          </p>
          <p className="text-slate-700 mb-4">
            Most national carriers quote a low base price then add fees for insurance, tracking, and
            expedited service. With 101 Drivers, the price you see is the price you pay. Period.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-3">Key Features</h3>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-2">
            <li><strong>Flat-rate pricing:</strong> $101 for the first 25 miles, $1.80 per additional mile. Insurance included.</li>
            <li><strong>Real-time GPS tracking:</strong> Live map with driver location, ETA, and route.</li>
            <li><strong>Photo proof of delivery:</strong> Documented vehicle condition at pickup, transit, and delivery.</li>
            <li><strong>Full insurance coverage:</strong> Included at no extra cost. Covers from pickup to drop-off.</li>
            <li><strong>Instant quote & booking:</strong> See your price in 30 seconds. Book in 2 minutes.</li>
            <li><strong>Same-day delivery:</strong> Available for most Southern California routes.</li>
            <li><strong>For dealerships & individuals:</strong> Dealers get bulk delivery + dashboard. Individuals get instant booking — no account required.</li>
            <li><strong>Direct customer support:</strong> Call or text (424) 313-2168 — talk to a real person, not a call center.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-3">Best For</h3>
          <p className="text-slate-700 mb-4">
            101 Drivers is ideal for:
          </p>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-2">
            <li>California residents who want a fast, local service</li>
            <li>Dealerships needing regular vehicle transport</li>
            <li>Individuals buying cars online who want transparent pricing</li>
            <li>Anyone who wants real-time tracking and photo proof</li>
            <li>Customers who hate hidden fees and surprise charges</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-3">Pricing</h3>
          <p className="text-slate-700 mb-4">
            101 Drivers uses a simple flat-rate pricing model:
          </p>
          <Card className="mb-6 not-prose">
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-slate-900">$101</div>
                <p className="text-slate-600">First 25 miles (flat rate)</p>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <span>Each additional mile</span>
                  <span className="font-bold">$1.80</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Insurance</span>
                  <span className="font-bold text-lime-600">INCLUDED</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>GPS tracking</span>
                  <span className="font-bold text-lime-600">INCLUDED</span>
                </div>
                <div className="flex justify-between">
                  <span>Photo proof</span>
                  <span className="font-bold text-lime-600">INCLUDED</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-slate-100 p-6 rounded-lg mb-8 not-prose">
            <p className="text-slate-700 mb-0">
              <strong>Example pricing:</strong> A 60-mile delivery in Southern California costs
              approximately <strong>$152</strong> ($101 for first 25 miles + $63 for 35 additional
              miles). The same delivery with a national carrier would typically cost $250-$400 plus
              insurance fees.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            #2: Montway Auto Transport — Best for Out-of-State Moves
          </h2>
          <p className="text-slate-700 mb-4">
            Montway is one of the largest national auto transport brokers. They're a good option
            if you need to ship a vehicle across state lines, but they're not the best choice for
            in-state California deliveries.
          </p>
          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Pros</h3>
          <ul className="list-disc list-inside text-slate-700 mb-4 space-y-1">
            <li>Nationwide coverage — can ship to/from any US state</li>
            <li>Large network of carriers</li>
            <li>Established reputation (15+ years)</li>
          </ul>
          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Cons</h3>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-1">
            <li>Variable pricing — quotes change based on demand</li>
            <li>Insurance often costs extra ($150-$300)</li>
            <li>No real-time GPS tracking (estimated windows only)</li>
            <li>Long booking process (request quotes, compare, negotiate)</li>
            <li>Call center support — long hold times</li>
            <li>Not California-focused — limited local knowledge</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            #3: uShip — Best for Budget-Bidders (with Caveats)
          </h2>
          <p className="text-slate-700 mb-4">
            uShip is a marketplace where carriers bid on your shipment. It can be cheaper than
            traditional carriers, but the auction model has significant downsides.
          </p>
          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Pros</h3>
          <ul className="list-disc list-inside text-slate-700 mb-4 space-y-1">
            <li>Potential for lower prices via bidding</li>
            <li>Wide variety of carriers</li>
            <li>Good for unusual shipments (boats, RVs, heavy equipment)</li>
          </ul>
          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Cons</h3>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-1">
            <li>Auction model — you wait for bids, no instant pricing</li>
            <li>Carrier quality varies widely — some are excellent, some are not</li>
            <li>No standardized insurance — depends on individual carrier</li>
            <li>No real-time GPS tracking on most shipments</li>
            <li>Customer reviews often complain about no-shows and delays</li>
            <li>Hard to predict final cost — bidding can drive price up</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            #4: AmeriFreight — Best for Discounts (with Trade-offs)
          </h2>
          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Pros</h3>
          <ul className="list-disc list-inside text-slate-700 mb-4 space-y-1">
            <li>Offers military, student, and senior discounts</li>
            <li>Nationwide coverage</li>
            <li>Better Business Bureau accredited</li>
          </ul>
          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Cons</h3>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-1">
            <li>Variable pricing — base quote often excludes fees</li>
            <li>Insurance often costs extra</li>
            <li>No real-time GPS tracking</li>
            <li>Not California-focused</li>
            <li>Quote-based — no instant pricing</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            #5: SGT Auto Transport — Decent, but Nothing Special
          </h2>
          <p className="text-slate-700 mb-4">
            SGT Auto Transport is a standard national broker. They get the job done, but they
            don't stand out in any particular area. Similar pricing model to Montway with similar
            limitations for in-state California moves.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            Head-to-Head Comparison
          </h2>
          <p className="text-slate-700 mb-6">
            Here's how 101 Drivers compares to the national carriers across the criteria that
            matter most:
          </p>

          {/* Comparison Table */}
          <div className="overflow-x-auto mb-8 not-prose">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left p-4 font-bold text-slate-900 border-b-2 border-slate-200">
                    Feature
                  </th>
                  <th className="text-left p-4 font-bold text-lime-600 border-b-2 border-slate-200">
                    101 Drivers
                  </th>
                  <th className="text-left p-4 font-bold text-slate-500 border-b-2 border-slate-200">
                    National Carriers
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-4 font-medium text-slate-900 border-b border-slate-200">
                      {row.feature}
                    </td>
                    <td className="p-4 text-slate-700 border-b border-slate-200">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-lime-500 shrink-0 mt-0.5" />
                        <span>{row.drivers101}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-700 border-b border-slate-200">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{row.national}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            How to Choose the Right Car Delivery Service
          </h2>
          <p className="text-slate-700 mb-4">
            Choosing the right car delivery service comes down to your specific needs:
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">
            Choose 101 Drivers if:
          </h3>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-2">
            <li>You're shipping a vehicle within California</li>
            <li>You want transparent, flat-rate pricing with no surprises</li>
            <li>You want to track your vehicle in real-time</li>
            <li>You want photo proof of pickup and delivery</li>
            <li>You want insurance included at no extra cost</li>
            <li>You want to book in 2 minutes, not 2 hours</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">
            Choose a national carrier if:
          </h3>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-2">
            <li>You're shipping a vehicle across state lines</li>
            <li>You don't mind waiting for quotes and negotiating</li>
            <li>You don't need real-time tracking</li>
            <li>You're OK with insurance as an add-on fee</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            What to Look for in a Car Delivery Service
          </h2>
          <p className="text-slate-700 mb-4">
            Regardless of which service you choose, here are the key factors to evaluate:
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">1. Pricing Transparency</h3>
          <p className="text-slate-700 mb-4">
            The biggest complaint about car delivery services is hidden fees. Look for a service
            that shows you the full price upfront — including insurance, tracking, and any other
            fees. If a quote looks too good to be true, it probably is.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">2. Insurance Coverage</h3>
          <p className="text-slate-700 mb-4">
            Always ask what insurance is included. Standard carrier insurance covers $50,000-$100,000
            of vehicle value, but some carriers charge extra for full coverage. 101 Drivers includes
            full insurance at no additional cost.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">3. Tracking Capabilities</h3>
          <p className="text-slate-700 mb-4">
            Real-time GPS tracking gives you peace of mind and helps you plan around the delivery.
            Most national carriers only provide estimated pickup and delivery windows — not
            real-time tracking. 101 Drivers provides live GPS on every delivery.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">4. Delivery Speed</h3>
          <p className="text-slate-700 mb-4">
            How fast do you need your vehicle delivered? 101 Drivers offers same-day delivery for
            most Southern California routes. National carriers typically take 3-7 days for
            in-state moves.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">5. Customer Support</h3>
          <p className="text-slate-700 mb-4">
            When something goes wrong, you want to talk to a real person who can help. 101 Drivers
            offers direct phone and text support. National carriers route you through call centers
            with long hold times.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6 not-prose">
            {faqs.map((faq, idx) => (
              <Card key={idx}>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-3 text-slate-900">{faq.q}</h3>
                  <p className="text-slate-700">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            The Verdict
          </h2>
          <p className="text-slate-700 mb-4">
            For California residents, <strong>101 Drivers is the clear winner</strong>. It's the
            only service that combines transparent flat-rate pricing, real-time GPS tracking,
            photo proof of delivery, and full insurance coverage — all included at no extra cost.
          </p>
          <p className="text-slate-700 mb-4">
            National carriers like Montway, AmeriFreight, and SGT Auto Transport are fine for
            cross-country moves, but they fall short on the features that matter most to
            California residents: local knowledge, fast delivery, transparent pricing, and
            real-time tracking.
          </p>
          <p className="text-slate-700 mb-4">
            uShip's auction model can work for unusual shipments, but the unpredictable pricing
            and variable carrier quality make it a poor choice for most California car deliveries.
          </p>
          <p className="text-slate-700 mb-4">
            <strong>The bottom line:</strong> If you're shipping a vehicle in California, 101
            Drivers offers the best combination of price, features, and customer experience. Get
            an instant quote and book in 2 minutes — no account required.
          </p>
        </div>

        {/* CTA */}
        <div className="max-w-3xl mx-auto mt-12">
          <Card className="bg-lime-500 border-0">
            <CardContent className="p-8 text-center text-white">
              <h2 className="text-2xl font-bold mb-3">
                Ready to Book Your Car Delivery?
              </h2>
              <p className="text-lime-50 mb-6">
                Get an instant flat-rate quote. No account required. Book in 2 minutes.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link to="/">
                  <Button size="lg" className="bg-white text-lime-600 hover:bg-slate-100">
                    Get Instant Quote
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <a href="tel:+14243132168">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-lime-600">
                    <Phone className="mr-2 w-4 h-4" />
                    (424) 313-2168
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Related Resources */}
        <div className="max-w-3xl mx-auto mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Resources</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Link to="/cities/los-angeles" className="block p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2 text-lime-600 font-medium mb-1">
                <MapPin className="w-4 h-4" />
                Car Delivery in Los Angeles
              </div>
              <p className="text-sm text-slate-600">
                Flat-rate car delivery throughout LA County — $101 for first 25 miles.
              </p>
            </Link>
            <Link to="/about" className="block p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2 text-lime-600 font-medium mb-1">
                <Car className="w-4 h-4" />
                About 101 Drivers
              </div>
              <p className="text-sm text-slate-600">
                Learn about our compliance-first, flat-rate vehicle delivery service.
              </p>
            </Link>
            <Link to="/help-customer" className="block p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2 text-lime-600 font-medium mb-1">
                <Shield className="w-4 h-4" />
                Customer Help & FAQs
              </div>
              <p className="text-sm text-slate-600">
                Answers to common questions about car delivery, tracking, and insurance.
              </p>
            </Link>
            <Link to="/driver-onboarding" className="block p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2 text-lime-600 font-medium mb-1">
                <Truck className="w-4 h-4" />
                Drive for 101 Drivers
              </div>
              <p className="text-sm text-slate-600">
                Earn money delivering vehicles in California. Weekly payouts.
              </p>
            </Link>
          </div>
        </div>
      </article>
    </div>
  )
}
