import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { SEOHead } from '@/components/shared/SEOHead'
import { NavBar } from '@/components/shared/layout/navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Phone, Clock, MapPin, Car, Navigation, DollarSign, Shield, CheckCircle2 } from 'lucide-react'

export const Route = createFileRoute('/blog/transport-car-los-angeles-to-san-diego/')({
  component: TransportCarLAToSanDiego,
})

function TransportCarLAToSanDiego() {
  const faqs = [
    { q: 'How much does it cost to ship a car from Los Angeles to San Diego?', a: 'Shipping a car from Los Angeles to San Diego (approximately 130 miles) costs $308 with 101 Drivers flat-rate pricing ($101 for first 25 miles + $1.80/mile for 105 additional miles). Insurance, GPS tracking, and photo proof are included. National carriers typically charge $400-$700 for the same route.' },
    { q: 'How long does it take to transport a car from LA to San Diego?', a: '101 Drivers typically completes LA to San Diego deliveries within 4-6 hours, including pickup and drop-off. The drive itself takes about 2-3 hours depending on traffic. National carriers often take 1-3 days for the same route.' },
    { q: 'What is the cheapest way to ship a car from Los Angeles to San Diego?', a: 'The cheapest way to ship a car from LA to San Diego is using 101 Drivers flat-rate service at $308, which includes insurance and tracking. Avoid auction-based platforms and national carriers with hidden fees. Driving yourself costs about $40-$60 in gas + your time, but adds 130 miles to your vehicle.' },
    { q: 'Can I track my car during transport from LA to San Diego?', a: 'Yes. 101 Drivers provides real-time GPS tracking on every LA to San Diego delivery. You receive a tracking link via SMS and email and can see your vehicle on a live map, see the driver\'s location, ETA, and receive photo proof of pickup and delivery.' },
    { q: 'Is my vehicle insured during transport from LA to San Diego?', a: 'Yes. 101 Drivers includes full insurance coverage at no additional cost on every delivery, including LA to San Diego. Your vehicle is covered from pickup to drop-off. Many national carriers charge $150-$300 extra for insurance.' },
    { q: 'What areas in San Diego do you deliver to?', a: '101 Drivers delivers to all of San Diego County including Downtown San Diego, La Jolla, Pacific Beach, Mission Valley, Chula Vista, Carlsbad, Escondido, Oceanside, El Cajon, San Marcos, Vista, Encinitas, National City, Imperial Beach, and all other San Diego neighborhoods.' },
    { q: 'Can I ship a car from LA to San Diego same-day?', a: 'Yes. 101 Drivers offers same-day delivery for most LA to San Diego routes. Book before 11 AM for same-day pickup. Most deliveries are completed within 4-6 hours from booking.' },
  ]

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="How to Transport a Car from Los Angeles to San Diego (2026 Guide)"
        description="Complete guide to shipping a car from Los Angeles to San Diego. Cost $308 flat-rate with 101 Drivers (insurance + GPS included). Compare options, timing, and tips for LA → SD car transport."
        canonicalUrl="https://101drivers.com/blog/transport-car-los-angeles-to-san-diego"
        schema={[
          { '@context': 'https://schema.org', '@type': 'Article', headline: 'How to Transport a Car from Los Angeles to San Diego (2026 Guide)', author: { '@type': 'Organization', name: '101 Drivers', url: 'https://101drivers.com' }, publisher: { '@type': 'Organization', name: '101 Drivers', logo: { '@type': 'ImageObject', url: 'https://101drivers.com/apple-touch-icon.png' } }, datePublished: '2026-08-27', dateModified: '2026-08-27', image: 'https://101drivers.com/og-image.png', url: 'https://101drivers.com/blog/transport-car-los-angeles-to-san-diego' },
          { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
          { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://101drivers.com/' }, { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://101drivers.com/blog' }, { '@type': 'ListItem', position: 3, name: 'Transport Car LA to San Diego', item: 'https://101drivers.com/blog/transport-car-los-angeles-to-san-diego' }] },
        ]}
      />
      <NavBar />
      <section className="bg-gradient-to-br from-slate-50 to-slate-100 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Link to="/" className="hover:text-lime-600">Home</Link><span>›</span>
            <span>Blog</span><span>›</span>
            <span className="text-slate-900">Transport Car LA to San Diego</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">How to Transport a Car from Los Angeles to San Diego</h1>
          <p className="text-xl text-slate-600 mb-6">The complete 2026 guide — cost, timing, options, and tips for the LA → SD route.</p>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> 8 min read</div>
            <div className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Route guide</div>
          </div>
        </div>
      </section>

      <article className="py-16 px-4">
        <div className="max-w-3xl mx-auto prose prose-slate prose-lg">
          <div className="bg-lime-50 border-l-4 border-lime-500 p-6 mb-8 rounded-r-lg not-prose">
            <p className="text-slate-700 mb-0"><strong className="text-slate-900">Quick answer:</strong> Transporting a car from Los Angeles to San Diego (about 130 miles) costs <strong>$308 with 101 Drivers</strong> flat-rate (insurance + GPS included). The drive takes 2-3 hours; shipping takes 4-6 hours total with no effort on your part.</p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Route Overview: LA to San Diego</h2>
          <p className="text-slate-700 mb-4">The Los Angeles to San Diego route is one of the most popular car transport routes in California. The drive is approximately 130 miles via I-5 South or I-405 S to I-5 S, and typically takes 2-3 hours depending on traffic.</p>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-2">
            <li><strong>Distance:</strong> ~130 miles</li>
            <li><strong>Drive time:</strong> 2-3 hours (without traffic)</li>
            <li><strong>Major routes:</strong> I-5 S, I-405 S to I-5 S</li>
            <li><strong>101 Drivers cost:</strong> $308 (flat rate, insurance included)</li>
            <li><strong>101 Drivers time:</strong> 4-6 hours total (pickup + transit + drop-off)</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Cost Comparison: LA to San Diego Car Transport</h2>
          <div className="overflow-x-auto mb-6 not-prose">
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-slate-100">
                <th className="text-left p-4 font-bold text-slate-900 border-b-2 border-slate-200">Service</th>
                <th className="text-left p-4 font-bold text-slate-900 border-b-2 border-slate-200">Cost</th>
                <th className="text-left p-4 font-bold text-slate-900 border-b-2 border-slate-200">Time</th>
                <th className="text-left p-4 font-bold text-slate-900 border-b-2 border-slate-200">Insurance</th>
              </tr></thead>
              <tbody>
                <tr className="bg-lime-50"><td className="p-4 font-bold text-lime-700 border-b border-slate-200">101 Drivers</td><td className="p-4 font-bold text-lime-700 border-b border-slate-200">$308</td><td className="p-4 border-b border-slate-200">4-6 hours</td><td className="p-4 text-lime-700 font-bold border-b border-slate-200">INCLUDED</td></tr>
                <tr className="bg-white"><td className="p-4 font-medium border-b border-slate-200">National carriers</td><td className="p-4 border-b border-slate-200">$400-$700</td><td className="p-4 border-b border-slate-200">1-3 days</td><td className="p-4 border-b border-slate-200">+$150-$300</td></tr>
                <tr className="bg-slate-50"><td className="p-4 font-medium border-b border-slate-200">uShip (auction)</td><td className="p-4 border-b border-slate-200">$200-$500</td><td className="p-4 border-b border-slate-200">Varies</td><td className="p-4 border-b border-slate-200">Varies</td></tr>
                <tr className="bg-white"><td className="p-4 font-medium">Drive yourself</td><td className="p-4">$40-$60 (gas)</td><td className="p-4">2-3 hours</td><td className="p-4">Your policy</td></tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">How 101 Drivers Pricing Works for LA → San Diego</h2>
          <Card className="mb-6 not-prose"><CardContent className="p-6">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-slate-900">$308</div>
              <p className="text-slate-600">Total cost (insurance + tracking included)</p>
            </div>
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between"><span>First 25 miles (flat rate)</span><span className="font-bold">$101</span></div>
              <div className="flex justify-between"><span>Next 105 miles × $1.80/mile</span><span className="font-bold">$189</span></div>
              <div className="flex justify-between"><span>Insurance (full coverage)</span><span className="font-bold text-lime-600">INCLUDED</span></div>
              <div className="flex justify-between"><span>GPS tracking</span><span className="font-bold text-lime-600">INCLUDED</span></div>
              <div className="flex justify-between"><span>Photo proof of delivery</span><span className="font-bold text-lime-600">INCLUDED</span></div>
            </div>
          </CardContent></Card>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Step-by-Step: How to Ship Your Car from LA to San Diego</h2>
          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Step 1: Get an Instant Quote</h3>
          <p className="text-slate-700 mb-4">Go to <Link to="/" className="text-lime-600 hover:underline">101drivers.com</Link> and enter your LA pickup address and San Diego drop-off address. You'll see a flat-rate quote of $308 in 30 seconds — no waiting, no quotes needed.</p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Step 2: Book Online</h3>
          <p className="text-slate-700 mb-4">Choose your pickup time and date. Book in 2 minutes — no account required for individuals. Dealerships can create a free account for streamlined booking.</p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Step 3: Meet Your Driver in LA</h3>
          <p className="text-slate-700 mb-4">Your vetted driver arrives at your LA location, photographs your vehicle's condition, and begins the journey. You receive a tracking link via SMS and email.</p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Step 4: Track in Real-Time</h3>
          <p className="text-slate-700 mb-4">Watch your vehicle move from LA to San Diego on a live map. See driver location, ETA, and route. Get notified when your vehicle is picked up and when it's approaching the destination.</p>

          <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">Step 5: Receive in San Diego</h3>
          <p className="text-slate-700 mb-4">Your driver arrives at your San Diego address, photographs the vehicle condition at delivery, and you confirm receipt. Payment is processed only after successful delivery.</p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Tips for LA to San Diego Car Transport</h2>
          <ul className="list-disc list-inside text-slate-700 mb-6 space-y-2">
            <li><strong>Book in advance:</strong> Book 1-2 days ahead for best availability, though same-day is often available.</li>
            <li><strong>Avoid rush hour:</strong> LA traffic is worst 7-10 AM and 4-7 PM. Mid-morning or early afternoon pickups save time.</li>
            <li><strong>Take photos:</strong> Take your own photos of your vehicle before pickup for your records.</li>
            <li><strong>Remove valuables:</strong> Remove personal items from the vehicle before transport.</li>
            <li><strong>Check fuel level:</strong> Keep fuel between 1/4 and 1/2 tank — enough for loading/unloading.</li>
            <li><strong>Disable alarms:</strong> Disable car alarms before pickup to avoid issues during transport.</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">San Diego Service Areas</h2>
          <p className="text-slate-700 mb-4">101 Drivers delivers to all of San Diego County, including:</p>
          <div className="grid grid-cols-2 gap-2 mb-6 not-prose">
            {['Downtown San Diego', 'La Jolla', 'Pacific Beach', 'Mission Valley', 'Chula Vista', 'Carlsbad', 'Escondido', 'Oceanside', 'El Cajon', 'San Marcos', 'Vista', 'Encinitas', 'National City', 'Imperial Beach', 'Coronado', 'Spring Valley', 'Santee', 'Lemon Grove'].map(area => (
              <div key={area} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded text-sm">
                <CheckCircle2 className="w-4 h-4 text-lime-500 shrink-0" />
                {area}
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-6 not-prose">
            {faqs.map((faq, idx) => (
              <Card key={idx}><CardContent className="p-6">
                <h3 className="font-bold text-lg mb-3 text-slate-900">{faq.q}</h3>
                <p className="text-slate-700">{faq.a}</p>
              </CardContent></Card>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">The Bottom Line</h2>
          <p className="text-slate-700 mb-4">Shipping a car from Los Angeles to San Diego with 101 Drivers costs <strong>$308 flat-rate</strong>, includes insurance + GPS tracking, and takes 4-6 hours total. It's cheaper, safer, and faster than driving yourself or using national carriers with hidden fees.</p>
        </div>

        <div className="max-w-3xl mx-auto mt-12">
          <Card className="bg-lime-500 border-0"><CardContent className="p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-3">Ship Your Car from LA to San Diego</h2>
            <p className="text-lime-50 mb-6">$308 flat rate. Insurance + GPS included. 4-6 hour delivery.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to="/"><Button size="lg" className="bg-white text-lime-600 hover:bg-slate-100">Get Quote<ArrowRight className="ml-2 w-4 h-4" /></Button></Link>
              <a href="tel:+14243132168"><Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-lime-600"><Phone className="mr-2 w-4 h-4" />(424) 313-2168</Button></a>
            </div>
          </CardContent></Card>
        </div>
      </article>
    </div>
  )
}
