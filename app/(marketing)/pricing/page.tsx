import { headers } from 'next/headers'
import Link from 'next/link'
import PricingTiers from '../_components/pricing-tiers'

export const metadata = {
  title: 'Pricing — HydroStack',
  description:
    'Four tiers — Student (free), Solo, Studio, Enterprise. Free during beta. Compare against the NPR 600,000–1,200,000 a consultancy charges per DFS.',
}

export default async function PricingPage() {
  const h = await headers()
  const country = h.get('x-vercel-ip-country') || 'NP'
  const currency: 'NPR' | 'USD' = country === 'NP' ? 'NPR' : 'USD'

  return (
    <section className="bg-stone-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
        {/* Page header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-stone-500 mb-3"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Rate card · 2026
          </p>
          <h1
            className="text-4xl lg:text-5xl text-stone-900 tracking-tight leading-tight mb-4"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
          >
            Honest pricing for a serious tool.
          </h1>
          <p className="text-stone-700 text-lg leading-relaxed">
            One DFS consultancy fee in Nepal is NPR 600,000–1,200,000.
            A year of Solo costs less than a single export.
          </p>
        </div>

        <PricingTiers currency={currency} />

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2
            className="text-2xl text-stone-900 mb-8 text-center"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
          >
            Common questions
          </h2>
          <div className="space-y-6">
            <Faq
              q="What does &ldquo;free during beta&rdquo; mean?"
              a="Every tier is unrestricted at no charge until the first stable release. When billing turns on, every beta signup keeps their tier at beta pricing for life — locked in."
            />
            <Faq
              q="Do I need a credit card to start?"
              a="No. Sign up with a magic link or Google. You can build a full DFS without paying anything."
            />
            <Faq
              q="Which standards do the reports cite?"
              a="AEPC DFS 2014, AEPC POHV 2008, IS 5330:1984, IS 11625:1986, IS 11639 Parts 1–3, IS 11388:1995, and AHEC-IITR modules where applicable. Every calculation has an inline citation."
            />
            <Faq
              q="Can I cancel anytime?"
              a="Yes. Monthly plans cancel monthly, annual plans cancel at the end of the term. Your project data stays exportable for 30 days after cancellation."
            />
            <Faq
              q="Is HydroStack approved by AEPC?"
              a="HydroStack produces submission-ready reports that follow the AEPC DFS 2014 format and cite all required standards. The AEPC review is performed by their officers — we do not promise approval, we promise the document arrives complete and correct."
            />
          </div>

          <div className="mt-14 text-center">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center gap-2 bg-emerald-800 hover:bg-emerald-900 text-emerald-50 px-7 py-3.5 text-[14px] font-medium tracking-wide transition-colors"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Start free — no credit card
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border border-stone-200 bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 hover:bg-stone-50 transition-colors">
        <span
          className="text-[15px] text-stone-900"
          style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
        >
          {q}
        </span>
        <span className="text-stone-400 group-open:rotate-45 transition-transform text-lg leading-none" aria-hidden>
          +
        </span>
      </summary>
      <p className="px-5 pb-4 pt-1 text-[14px] text-stone-700 leading-relaxed">{a}</p>
    </details>
  )
}