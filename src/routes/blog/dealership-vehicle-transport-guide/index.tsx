import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { SEOHead } from '@/components/shared/SEOHead'
import { NavBar } from '@/components/shared/layout/navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Phone, Clock, Building, Truck, Shield, Users, TrendingUp, DollarSign, CheckCircle2, Star } from 'lucide-react'

export const Route = createFileRoute('/blog/dealership-vehicle-transport-guide/')({
  component: DealershipVehicleTransportGuide,
})

function DealershipVehicleTransportGuide() {
  const faqs = [
    { q: 'How much does dealership vehicle transport cost in California?', a: 'Dealership vehicle transport costs in California depend on volume and distance. With 101 Drivers, single deliveries start at $101 for the first 25 miles + $1.80/mile. Dealerships that sign up for an account get bulk delivery discounts (10-15% off), a dashboard to manage all transports, and streamlined booking. Most dealerships save 20-30% vs. national carriers.' },
    { q: 'How do I set up a dealership account with 101 Drivers?', a: 'Setting up a dealership account is free and takes 5 minutes. Go to 101drivers.com/auth/dealer-signup, enter your dealership information, and verify your email. Once approved, you get a dealer dashboard, bulk delivery pricing, and priority booking.' },
    { q: 'Can 101 Drivers handle bulk vehicle transport for dealerships?', a: 'Yes. 101 Drivers works with automotive dealerships of all sizes — from single-location used car lots to multi-location new car franchises. We handle bulk deliveries, auction purchases, trade-ins, customer home deliveries, and dealer-to-dealer transfers. Contact us for custom pricing on high-volume accounts.' },
    { q: 'Does 101 Drivers provide proof of vehicle condition for dealership inventory?', a: 'Yes. 101 Drivers documents your vehicle\'s condition with photos at pickup, transit stops, and delivery. This protects your dealership from damage claims and provides documentation for your records. Every delivery includes a condition report and photo proof.' },
    { q: 'Can I track multiple dealership vehicles in transit?', a: 'Yes. Dealership accounts include a dashboard that shows all your in-transit vehicles on a single map. You can track every delivery in real-time, see ETAs, and receive delivery confirmations. No more calling dispatchers for status updates.' },
    { q: 'What types of vehicles can 101 Drivers transport for dealerships?', a: '101 Drivers transports all types of vehicles including sedans, SUVs, trucks, vans, luxury vehicles, EVs, and classics. We do not charge SUV/truck surcharges like many national carriers — the same flat rate applies regardless of vehicle type.' },
    { q: 'Does 101 Drivers offer home delivery for dealership customers?', a: 'Yes. Many dealerships use 101 Drivers to deliver vehicles directly to their customers\' homes. When a customer buys a car, you book delivery through your dealer dashboard, and we deliver the vehicle to their address with photo proof and GPS tracking.' },
  ]

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Dealership Vehicle Transport Guide: Everything You Need to Know (2026)"
        description="Complete guide to dealership vehicle transport in California. Learn how 101 Drivers helps dealerships save 20-30% on bulk delivery, auction transport, trade-ins, and customer home delivery. Free dealer account."
        canonicalUrl="https://101drivers.com/blog/dealership-vehicle-transport-guide"
        schema={[
          { '@context': 'https://schema.org', '@type': 'Article', headline: 'Dealership Vehicle Transport Guide: Everything You Need to Know', author: { '@type': 'Organization', name: '101 Drivers', url: 'https://101drivers.com' }, publisher: { '@type': 'Organization', name: '101 Drivers', logo: { '@type': 'ImageObject', url: 'https://101drivers.com/apple-touch-icon.png' } }, datePublished: '2026-08-27', dateModified: '2026-08-27', image: 'https://101drivers.com/og-image.png', url: 'https://101drivers.com/blog/dealership-vehicle-transport-guide' },
          { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
          { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://101drivers.com/' }, { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://101drivers.com/blog' }, { '@type': 'ListItem', position: 3, name: 'Dealership Vehicle Transport Guide', item: 'https://101drivers.com/blog/dealership-vehicle-transport-guide' }] },
        ]}
      />
      <NavBar />
      <section className="bg-gradient-to-br from-slate-50 to-slate-100 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Link to="/" className="hover:text-lime-600">Home</Link><span>›</span>
            <span>Blog</span><span>›</span>
            <span className="text-slate-900">Dealership Vehicle Transport Guide</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">Dealership Vehicle Transport Guide</h1>
          <p className="text-xl text-slate-600 mb-6">Everything dealerships need to know about vehicle transport in California — bulk delivery, auctions, trade-ins, and customer home delivery.</p>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> 12 min read</div>
            <div className="flex items-center gap-1"><Building className="w-4 h-4" /> For dealerships</div>
          </div>
        </div>
      </section>

      <article className="py-16 px-4">
        <div className="max-w-3xl mx-auto prose prose-slate prose-lg">
          <div className="bg-lime-50 border-l-4 border-lime-500 p-6 mb-8 rounded-r-lg not-prose">
            <p className="text-slate-700 mb-0"><strong className="text-slate-900">For dealership owners and managers:</strong> 101 Drivers offers California dealerships a modern, transparent alternative to traditional auto transport brokers. Get <strong>flat-rate pricing, real-time GPS tracking, a dealer dashboard, and 20-30% savings</strong> vs. national carriers — with insurance included on every delivery.</p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Why Dealerships Choose 101 Drivers</h2>
          <p className="text-slate-700 mb-4">Running a dealership means moving vehicles constantly — from auctions, trade-ins, customer home deliveries, dealer-to-dealer transfers, and inventory repositioning. Traditional auto transport brokers make this painful with variable pricing, hidden fees, and no real-time visibility.</p>
          <p className="text-slate-700 mb-4">101 Drivers is built for dealerships. Here's what makes us different:</p>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-2">
            <li><CheckCircle2 className="inline w-4 h-4 text-lime-500 mr-2" /><strong>Flat-rate pricing</strong> — $101 first 25 miles + $1.80/mile. Same rate regardless of vehicle type.</li>
            <li><CheckCircle2 className="inline w-4 h-4 text-lime-500 mr-2" /><strong>Real-time GPS tracking</strong> — track all your vehicles on one dashboard.</li>
            <li><CheckCircle2 className="inline w-4 h-4 text-lime-500 mr-2" /><strong>Photo proof of condition</strong> — protect yourself from damage claims.</li>
            <li><CheckCircle2 className="inline w-4 h-4 text-lime-500 mr-2" /><strong>Insurance included</strong> — no extra fees. Full coverage from pickup to drop-off.</li>
            <li><CheckCircle2 className="inline w-4 h-4 text-lime-500 mr-2" /><strong>Bulk delivery discounts</strong> — save 10-15% on high-volume accounts.</li>
            <li><CheckCircle2 className="inline w-4 h-4 text-lime-500 mr-2" /><strong>Dealer dashboard</strong> — manage all your transports, drivers, and deliveries in one place.</li>
            <li><CheckCircle2 className="inline w-4 h-4 text-lime-500 mr-2" /><strong>Priority booking</strong> — dealers get first access to available drivers.</li>
            <li><CheckCircle2 className="inline w-4 h-4 text-lime-500 mr-2" /><strong>No SUV/truck surcharge</strong> — same rate for sedans, SUVs, trucks, vans.</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">5 Common Dealership Vehicle Transport Scenarios</h2>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">1. Auction Purchases</h3>
          <p className="text-slate-700 mb-4">Buying vehicles at auction? 101 Drivers picks up from major California auction houses (Manheim, Adesa, Copart, IAA) and delivers to your dealership. Get an instant quote, book in 2 minutes, and track your purchase in real-time. No more waiting for broker callbacks.</p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">2. Trade-In Vehicle Transport</h3>
          <p className="text-slate-700 mb-4">When a customer trades in a vehicle, you often need to move it between lots or to a wholesale auction. 101 Drivers handles trade-in transport with photo documentation of condition — protecting you from disputes about pre-existing damage.</p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">3. Customer Home Delivery</h3>
          <p className="text-slate-700 mb-4">Modern customers expect home delivery. With 101 Drivers, you can offer free or paid home delivery to your customers — we deliver their new vehicle to their driveway with photo proof and GPS tracking. Your customer gets a tracking link and you get delivery confirmation.</p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">4. Dealer-to-Dealer Transfers</h3>
          <p className="text-slate-700 mb-4">Need to move inventory between your dealership locations or trade vehicles with another dealer? 101 Drivers handles dealer-to-dealer transfers across California with the same flat-rate pricing and real-time tracking.</p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">5. Inventory Repositioning</h3>
          <p className="text-slate-700 mb-4">Sometimes you need to move vehicles between lots to balance inventory. 101 Drivers makes this fast and affordable — book a single vehicle or multiple vehicles in one batch through your dealer dashboard.</p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">How 101 Drivers Compares to National Brokers</h2>
          <div className="overflow-x-auto mb-6 not-prose">
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-slate-100">
                <th className="text-left p-4 font-bold text-slate-900 border-b-2 border-slate-200">Feature</th>
                <th className="text-left p-4 font-bold text-lime-600 border-b-2 border-slate-200">101 Drivers</th>
                <th className="text-left p-4 font-bold text-slate-500 border-b-2 border-slate-200">National Brokers</th>
              </tr></thead>
              <tbody>
                <tr className="bg-white"><td className="p-4 font-medium border-b border-slate-200">Pricing model</td><td className="p-4 text-lime-700 font-bold border-b border-slate-200">Flat rate</td><td className="p-4 border-b border-slate-200">Variable</td></tr>
                <tr className="bg-slate-50"><td className="p-4 font-medium border-b border-slate-200">SUV/truck surcharge</td><td className="p-4 text-lime-700 font-bold border-b border-slate-200">No</td><td className="p-4 border-b border-slate-200">Yes (10-20%)</td></tr>
                <tr className="bg-white"><td className="p-4 font-medium border-b border-slate-200">Insurance included</td><td className="p-4 text-lime-700 font-bold border-b border-slate-200">Yes</td><td className="p-4 border-b border-slate-200">Often extra ($150-$300)</td></tr>
                <tr className="bg-slate-50"><td className="p-4 font-medium border-b border-slate-200">Real-time GPS tracking</td><td className="p-4 text-lime-700 font-bold border-b border-slate-200">Yes — all vehicles</td><td className="p-4 border-b border-slate-200">Usually no</td></tr>
                <tr className="bg-white"><td className="p-4 font-medium border-b border-slate-200">Photo proof of condition</td><td className="p-4 text-lime-700 font-bold border-b border-slate-200">Yes</td><td className="p-4 border-b border-slate-200">Sometimes</td></tr>
                <tr className="bg-slate-50"><td className="p-4 font-medium border-b border-slate-200">Bulk delivery discount</td><td className="p-4 text-lime-700 font-bold border-b border-slate-200">10-15% off</td><td className="p-4 border-b border-slate-200">Varies</td></tr>
                <tr className="bg-white"><td className="p-4 font-medium border-b border-slate-200">Dealer dashboard</td><td className="p-4 text-lime-700 font-bold border-b border-slate-200">Yes</td><td className="p-4 border-b border-slate-200">Some have it</td></tr>
                <tr className="bg-slate-50"><td className="p-4 font-medium border-b border-slate-200">Booking time</td><td className="p-4 text-lime-700 font-bold border-b border-slate-200">2 minutes</td><td className="p-4 border-b border-slate-200">15-60 minutes</td></tr>
                <tr className="bg-white"><td className="p-4 font-medium">California knowledge</td><td className="p-4 text-lime-700 font-bold">Local expert</td><td className="p-4">National scope</td></tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">How to Set Up a Dealership Account</h2>
          <p className="text-slate-700 mb-4">Setting up a dealership account with 101 Drivers is free and takes 5 minutes:</p>
          <ol className="list-decimal list-inside text-slate-700 mb-6 space-y-2">
            <li>Go to <Link to="/auth/dealer-signup" className="text-lime-600 hover:underline">101drivers.com/auth/dealer-signup</Link></li>
            <li>Enter your dealership name, address, and contact info</li>
            <li>Verify your email address</li>
            <li>Submit your dealership license (DMV dealer license number)</li>
            <li>Get approved (usually within 24 hours)</li>
            <li>Start booking deliveries through your dealer dashboard</li>
          </ol>
          <p className="text-slate-700 mb-4">Once approved, you get immediate access to:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Bulk delivery pricing (10-15% off standard rates)</li>
              <li>Real-time dealer dashboard</li>
              <li>Priority booking — your deliveries get first access to drivers</li>
              <li>Direct customer support line</li>
              <li>Monthly billing (instead of per-delivery payment)</li>
              <li>Delivery history and reporting</li>
            </ul>
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Dealership Pricing Example</h2>
          <p className="text-slate-700 mb-4">Let's say your dealership needs to move 10 vehicles from an auction in LA to your lot in Orange County (about 50 miles):</p>
          <Card className="mb-6 not-prose"><CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between"><span>Per vehicle (50 miles)</span><span className="font-bold">$155</span></div>
              <div className="flex justify-between"><span>10 vehicles × $155</span><span className="font-bold">$1,550</span></div>
              <div className="flex justify-between text-lime-700"><span>Bulk discount (10%)</span><span className="font-bold">-$155</span></div>
              <div className="border-t pt-3 flex justify-between font-bold text-lg"><span>Total</span><span>$1,395</span></div>
              <p className="text-sm text-slate-500 mt-2">Insurance, GPS tracking, and photo proof included on every vehicle.</p>
            </div>
          </CardContent></Card>
          <p className="text-slate-700 mb-4"><strong>Compare to national carriers:</strong> The same 10-vehicle delivery would cost $2,500-$4,000 with national brokers, plus $1,500-$3,000 in insurance fees. <strong>You save $2,600-$4,600 with 101 Drivers.</strong></p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-6 not-prose">
            {faqs.map((faq, idx) => (
              <Card key={idx}><CardContent className="p-6">
                <h3 className="font-bold text-lg mb-3 text-slate-900">{faq.q}</h3>
                <p className="text-slate-700">{faq.a}</p>
              </CardContent></Card>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Get Started with 101 Drivers for Your Dealership</h2>
          <p className="text-slate-700 mb-4">If you're a California dealership looking for transparent, affordable vehicle transport with real-time tracking, 101 Drivers is your solution. Set up your free dealer account in 5 minutes and start saving 20-30% on every delivery.</p>
        </div>

        <div className="max-w-3xl mx-auto mt-12">
          <Card className="bg-lime-500 border-0"><CardContent className="p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-3">Set Up Your Free Dealer Account</h2>
            <p className="text-lime-50 mb-6">5-minute signup. Save 20-30% on vehicle transport.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to="/auth/dealer-signup"><Button size="lg" className="bg-white text-lime-600 hover:bg-slate-100">Sign Up Free<ArrowRight className="ml-2 w-4 h-4" /></Button></Link>
              <a href="tel:+14243132168"><Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-lime-600"><Phone className="mr-2 w-4 h-4" />(424) 313-2168</Button></a>
            </div>
          </CardContent></Card>
        </div>
      </article>
    </div>
  )
}
