import Link from 'next/link'

// ════════════════════════════════════════════════════════════════════════════
//  PricingTiers
//  Source of truth: Foundation Document §4.1
//  Geo-gating: parent component reads the Vercel-IP-Country header and
//  passes `currency` server-side. Both prices are stored here so the
//  same component renders correctly in either currency.
// ════════════════════════════════════════════════════════════════════════════

type Currency = 'NPR' | 'USD'

interface Tier {
  name: string
  tagline: string
  monthly: { NPR: string; USD: string }
  annual: { NPR: string; USD: string }
  seats: string
  projects: string
  features: string[]
  cta: { label: string; href: string }
  popular?: boolean
  free?: boolean
}

const TIERS: Tier[] = [
  {
    name: 'Student',
    tagline: 'For .edu.np verified emails.',
    monthly: { NPR: 'Free', USD: 'Free' },
    annual: { NPR: '', USD: '' },
    seats: '1 seat',
    projects: '2 projects',
    features: [
      'All calculation modules',
      'PDF export (watermarked)',
      'AEPC DFS 2014 report',
    ],
    cta: { label: 'Start free', href: '/login?mode=signup' },
    free: true,
  },
  {
    name: 'Solo',
    tagline: 'For independent consultants.',
    monthly: { NPR: 'NPR 2,500', USD: 'USD 29' },
    annual: { NPR: 'NPR 25,000 / yr · save 2 months', USD: 'USD 290 / yr · save 2 months' },
    seats: '1 seat',
    projects: '10 active projects',
    features: [
      'All calculation modules',
      'PDF + DOCX export, no watermark',
      'AEPC DFS 2014 report',
      'Email support',
    ],
    cta: { label: 'Start free trial', href: '/login?mode=signup' },
    popular: true,
  },
  {
    name: 'Studio',
    tagline: 'For small consultancies.',
    monthly: { NPR: 'NPR 9,000', USD: 'USD 99' },
    annual: { NPR: 'NPR 90,000 / yr', USD: 'USD 990 / yr' },
    seats: '5 seats',
    projects: 'Unlimited projects',
    features: [
      'Everything in Solo',
      'PDF + DOCX + Excel export',
      'Version history',
      'Priority email support',
    ],
    cta: { label: 'Contact sales', href: 'mailto:angel@usehydrostack.com?subject=HydroStack%20Studio%20enquiry' },
  },
  {
    name: 'Enterprise',
    tagline: 'For EPCs and developers.',
    monthly: { NPR: 'NPR 25,000', USD: 'USD 299' },
    annual: { NPR: 'NPR 250,000 / yr', USD: 'USD 2,990 / yr' },
    seats: '20 seats + SSO',
    projects: 'Unlimited projects',
    features: [
      'Everything in Studio',
      'API access',
      'White-label reports',
      'SLA + named contact',
    ],
    cta: { label: 'Contact sales', href: 'mailto:angel@usehydrostack.com?subject=HydroStack%20Enterprise%20enquiry' },
  },
]

export default function PricingTiers({ currency }: { currency: Currency }) {
  return (
    <div>
      {/* Beta notice */}
      <div
        className="mb-10 mx-auto max-w-3xl bg-emerald-50 border border-emerald-200 px-5 py-3.5 text-center"
      >
        <p
          className="text-[12px] tracking-[0.12em] uppercase text-emerald-800 mb-1"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          Beta · all tiers free
        </p>
        <p className="text-sm text-emerald-900">
          HydroStack is in public beta. Every tier is free until the first stable
          release. Sign up now and your beta pricing is locked in for life.
        </p>
      </div>

      {/* Currency indicator */}
      <p
        className="text-center mb-8 text-[11px] tracking-[0.18em] uppercase text-stone-500"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        Pricing shown in {currency === 'NPR' ? 'Nepalese Rupees (NPR)' : 'US Dollars (USD)'}
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} currency={currency} />
        ))}
      </div>

      <p
        className="text-center mt-10 text-[12px] text-stone-500 max-w-2xl mx-auto leading-relaxed"
      >
        Compare against the NPR 600,000–1,200,000 a consultancy charges per DFS.
        One Solo subscription pays back on the first export.
      </p>
    </div>
  )
}

function TierCard({ tier, currency }: { tier: Tier; currency: Currency }) {
  const monthly = tier.monthly[currency]
  const annual = tier.annual[currency]
  const isExternal = tier.cta.href.startsWith('mailto:')

  return (
    <div
      className={`relative flex flex-col bg-white border ${
        tier.popular
          ? 'border-emerald-800 shadow-[0_0_0_3px_rgba(6,95,70,0.08)]'
          : 'border-stone-200'
      } p-6 lg:p-7`}
    >
      {tier.popular && (
        <span
          className="absolute -top-3 left-6 bg-emerald-800 text-emerald-50 text-[10px] tracking-[0.18em] uppercase px-2.5 py-1"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          Most popular
        </span>
      )}

      <div>
        <h3
          className="text-2xl text-stone-900 mb-1"
          style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
        >
          {tier.name}
        </h3>
        <p className="text-[13px] text-stone-500 mb-5">{tier.tagline}</p>

        <div className="mb-5">
          <p
            className="text-3xl text-stone-900 leading-none"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
          >
            {monthly}
          </p>
          {!tier.free && (
            <p
              className="text-[11px] text-stone-500 mt-1"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              per month
            </p>
          )}
          {annual && (
            <p
              className="text-[11px] text-stone-500 mt-2"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              {annual}
            </p>
          )}
        </div>

        <div className="border-t border-stone-200 pt-4 mb-4 space-y-1">
          <p
            className="text-[12px] text-stone-700"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            <span className="text-stone-400">›</span> {tier.seats}
          </p>
          <p
            className="text-[12px] text-stone-700"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            <span className="text-stone-400">›</span> {tier.projects}
          </p>
        </div>

        <ul className="space-y-1.5 mb-7">
          {tier.features.map((feature) => (
            <li key={feature} className="text-[13px] text-stone-700 flex gap-2">
              <span className="text-emerald-700 mt-0.5" aria-hidden>
                ✓
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto pt-2">
        {isExternal ? (
          <a
            href={tier.cta.href}
            className={`block w-full text-center py-2.5 text-[13px] font-medium transition-colors ${
              tier.popular
                ? 'bg-emerald-800 hover:bg-emerald-900 text-emerald-50'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-50'
            }`}
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            {tier.cta.label}
          </a>
        ) : (
          <Link
            href={tier.cta.href}
            className={`block w-full text-center py-2.5 text-[13px] font-medium transition-colors ${
              tier.popular
                ? 'bg-emerald-800 hover:bg-emerald-900 text-emerald-50'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-50'
            }`}
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            {tier.cta.label}
          </Link>
        )}
      </div>
    </div>
  )
}