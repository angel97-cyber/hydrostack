import Link from 'next/link'
import { headers } from 'next/headers'
import PricingTiers from './_components/pricing-tiers'

// ════════════════════════════════════════════════════════════════════════════
//  Landing page — usehydrostack.com
//  Sections in order:
//    1. NAV       — in marketing layout
//    2. HERO      — headline, sub, CTA, social proof, hero illustration
//    3. MODULES   — 8 module strip (horizontal scroll on mobile)
//    4. FEATURES  — three columns: standards, report, built-by-engineer
//    5. PRICING   — geo-gated NPR vs USD
//    6. QUOTE     — Senior Checker testimonial
//    7. FOOTER    — in marketing layout
// ════════════════════════════════════════════════════════════════════════════

export const metadata = {
  title: "HydroStack — Nepal's mini hydropower DFS in a morning",
  description:
    'A standards-compliant calculation engine for AEPC DFS 2014. Replaces 13 years of Excel gymnastics. Built by a practising hydropower engineer.',
}

export default async function LandingPage() {
  // Geo-gate pricing currency server-side using the Vercel edge header.
  // Default to NPR when the header is absent (dev, direct IP, etc.) since
  // the home market is Nepal.
  const h = await headers()
  const country = h.get('x-vercel-ip-country') || 'NP'
  const currency: 'NPR' | 'USD' = country === 'NP' ? 'NPR' : 'USD'

  return (
    <>
      <HeroSection />
      <ModuleStrip />
      <FeatureCallouts />
      <PricingSection currency={currency} />
      <TestimonialSection />
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────
//  Section 2 — HERO
// ───────────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle drafting grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-20 lg:pb-28">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left — copy */}
          <div className="lg:col-span-7">
            <div
              className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] text-emerald-800 mb-8 uppercase font-medium"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <span className="inline-block w-1.5 h-1.5 bg-emerald-700" />
              AEPC DFS 2014 · IS 5330 · IS 11625 · IS 11639
            </div>

            <h1
              className="text-5xl sm:text-6xl lg:text-[5rem] xl:text-[5.5rem] leading-[0.96] tracking-tight text-stone-900 mb-7"
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontWeight: 500,
                fontFeatureSettings: '"ss01"',
              }}
            >
              Nepal&apos;s DFS<br />
              in a morning.<br />
              <span className="italic text-emerald-800" style={{ fontWeight: 400 }}>
                Not a week.
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-stone-700 leading-relaxed max-w-xl mb-8">
              HydroStack replaces thirteen years of Excel gymnastics with a
              standards-compliant calculation engine. Enter the site data once.
              Download a complete <span className="font-medium">AEPC DFS 2014</span> report.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-8">
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center gap-2 bg-emerald-800 hover:bg-emerald-900 text-emerald-50 px-6 py-3 text-[14px] font-medium tracking-wide transition-colors"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Start your first project — it&apos;s free
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/pricing"
                className="text-[14px] text-stone-700 hover:text-stone-900 underline underline-offset-4 decoration-stone-300 hover:decoration-stone-700 transition-colors px-2"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                See pricing
              </Link>
            </div>

            {/* Social proof chip */}
            <div className="inline-flex items-center gap-3 text-[12px] text-stone-600 border-l-2 border-emerald-700/40 pl-3">
              <span
                className="text-[10px] tracking-[0.18em] uppercase text-stone-500"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Built on
              </span>
              <span>
                the Shyam Khola Hydropower Project,{' '}
                <span className="text-stone-800 font-medium">Lamjung district</span>
              </span>
            </div>
          </div>

          {/* Right — hero illustration: project-hub-style preview */}
          <div className="lg:col-span-5">
            <HeroIllustration />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroIllustration() {
  // A condensed mockup of the HydroStack project hub: title bar + 8 module
  // cards with their completion states. Tells the story "you click through
  // modules, they fill in green, you export". Pure SVG/HTML, no images.
  const modules = [
    { n: '01', name: 'Hydrology', spec: 'Q40 / Q80', done: true },
    { n: '02', name: 'Intake & Settling', spec: 'AEPC §4.2', done: true },
    { n: '03', name: 'Headrace & Forebay', spec: 'Manning n', done: true },
    { n: '04', name: 'Penstock', spec: 'IS 11639', done: true },
    { n: '05', name: 'Anchor Block', spec: 'IS 5330', done: true },
    { n: '06', name: 'Powerhouse', spec: 'Turbine select', done: true },
    { n: '07', name: 'Energy Table', spec: 'Monthly GWh', done: true },
    { n: '08', name: 'Financial Model', spec: 'IRR / NPV', done: false, active: true },
  ]

  return (
    <div className="relative">
      {/* Drafting frame */}
      <div className="bg-white border border-stone-300 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.15)]">
        {/* Title block */}
        <div className="border-b border-stone-300 px-5 py-3 flex items-center justify-between bg-stone-50">
          <div>
            <p
              className="text-[10px] tracking-[0.18em] uppercase text-stone-500"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Project · DFS · AEPC 2014
            </p>
            <p
              className="text-sm text-stone-900 mt-0.5"
              style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
            >
              Shyam Khola HPP — 7.2 MW
            </p>
          </div>
          <div
            className="text-[10px] tracking-[0.18em] uppercase text-emerald-700 border border-emerald-700/40 px-2 py-0.5"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            7 / 8 complete
          </div>
        </div>

        {/* Module list */}
        <div className="divide-y divide-stone-200">
          {modules.map((m) => (
            <div
              key={m.n}
              className={`flex items-center gap-3 px-5 py-2.5 ${
                m.active ? 'bg-emerald-50/60' : ''
              }`}
            >
              <span
                className="text-[10px] text-stone-400 w-5"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                {m.n}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-stone-900 truncate">{m.name}</p>
                <p
                  className="text-[10px] text-stone-500"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  {m.spec}
                </p>
              </div>
              {m.done ? (
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-emerald-700"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  ✓ Saved
                </span>
              ) : m.active ? (
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  Active
                </span>
              ) : (
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-stone-400"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  Locked
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer action bar */}
        <div className="border-t border-stone-300 px-5 py-3 bg-stone-50 flex items-center justify-between">
          <p
            className="text-[10px] tracking-[0.18em] uppercase text-stone-500"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Export → .docx
          </p>
          <span
            className="text-[10px] tracking-[0.18em] uppercase text-stone-400"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            ~30 s
          </span>
        </div>
      </div>

      {/* Floating sheet number tag */}
      <div
        className="absolute -bottom-3 -right-3 bg-emerald-800 text-emerald-50 px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase shadow-lg"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        Sheet 01 / 60
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
//  Section 3 — MODULE STRIP
// ───────────────────────────────────────────────────────────────────────────

function ModuleStrip() {
  const modules = [
    { n: '01', name: 'Hydrology',           spec: 'WECS / DHM regression',           ico: WavesIcon },
    { n: '02', name: 'Intake',              spec: 'AEPC §4.2 trashrack + basin',     ico: GridIcon },
    { n: '03', name: 'Headrace & Forebay',  spec: "Manning's open channel",          ico: ChannelIcon },
    { n: '04', name: 'Penstock',            spec: 'IS 11639 wall thickness',         ico: PipeIcon },
    { n: '05', name: 'Anchor Block',        spec: 'IS 5330 — 12-force stability',    ico: BlockIcon },
    { n: '06', name: 'Powerhouse',          spec: 'Turbine + generator sizing',      ico: TurbineIcon },
    { n: '07', name: 'Energy Table',        spec: 'Monthly GWh + plant factor',      ico: ChartIcon },
    { n: '08', name: 'Financial Model',     spec: 'IRR · NPV · DSCR · LCOE',         ico: CoinIcon },
  ]

  return (
    <section className="border-y border-stone-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 lg:py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p
              className="text-[10px] tracking-[0.22em] uppercase text-stone-500 mb-2"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              §01 — Eight modules
            </p>
            <h2
              className="text-3xl lg:text-4xl text-stone-900 tracking-tight"
              style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
            >
              The whole DFS, end to end.
            </h2>
          </div>
          <p
            className="hidden md:block text-[12px] text-stone-500 max-w-xs text-right"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            → one-click AEPC DFS 2014 export
          </p>
        </div>

        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="flex lg:grid lg:grid-cols-4 gap-3 lg:gap-4 overflow-x-auto pb-2 lg:pb-0 snap-x snap-mandatory -mx-6 px-6 lg:mx-0 lg:px-0">
          {modules.map(({ n, name, spec, ico: Icon }) => (
            <div
              key={n}
              className="snap-start shrink-0 w-[260px] lg:w-auto border border-stone-200 bg-stone-50 hover:border-emerald-700 hover:bg-white transition-colors p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <Icon />
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-stone-400"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  Mod. {n}
                </span>
              </div>
              <p
                className="text-[15px] text-stone-900 leading-tight mb-1.5"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
              >
                {name}
              </p>
              <p
                className="text-[11px] text-stone-500 leading-snug"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                {spec}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Simple line-art icons for modules
function WavesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-emerald-800">
      <path d="M3 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 2-2" />
      <path d="M3 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 2-2" />
      <path d="M3 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 2-2" />
    </svg>
  )
}
function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-emerald-800">
      <path d="M4 4v16M8 4v16M12 4v16M16 4v16M20 4v16M2 8h20M2 16h20" />
    </svg>
  )
}
function ChannelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-emerald-800">
      <path d="M3 6l4 4v8M21 6l-4 4v8M7 18h10M7 14h10" />
    </svg>
  )
}
function PipeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-emerald-800">
      <rect x="3" y="9" width="14" height="6" rx="1" />
      <path d="M17 12h4M17 9l3-2M17 15l3 2" />
    </svg>
  )
}
function BlockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-emerald-800">
      <path d="M4 18l4-8 4 6 4-10 4 12H4z" />
      <path d="M2 20h20" />
    </svg>
  )
}
function TurbineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-emerald-800">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" />
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-emerald-800">
      <path d="M3 21V3M3 21h18M7 17v-5M11 17v-9M15 17v-4M19 17v-7" />
    </svg>
  )
}
function CoinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-emerald-800">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h4a2 2 0 010 4H9m0 0h5a2 2 0 010 4H9m3-10v12" />
    </svg>
  )
}

// ───────────────────────────────────────────────────────────────────────────
//  Section 4 — FEATURE CALLOUTS
// ───────────────────────────────────────────────────────────────────────────

function FeatureCallouts() {
  const features = [
    {
      title: 'Standards-cited calculations',
      body:
        'Every formula references AEPC DFS 2014, IS 5330:1984, IS 11639, or AHEC-IITR inline. Hand it to a Senior Checker — nothing to justify.',
      tag: 'AEPC · IS · AHEC',
    },
    {
      title: '60-page DFS report in 30 seconds',
      body:
        'Click Export. Download a Word document formatted for AEPC and DoED submission. Add letterhead, PE stamp, photos. Done.',
      tag: 'DOCX · PDF',
    },
    {
      title: 'Built by a hydropower engineer',
      body:
        'Angel Mainali — designer of the Shyam Khola HPP — built HydroStack because the existing tools were embarrassing. Not a startup guessing at what engineers need.',
      tag: 'Designed in Nepal',
    },
  ]

  return (
    <section className="bg-stone-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-2xl mb-12 lg:mb-16">
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-stone-500 mb-2"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            §02 — Why HydroStack
          </p>
          <h2
            className="text-3xl lg:text-4xl text-stone-900 tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
          >
            Three things the legacy Excel will never do.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {features.map((f, i) => (
            <div key={f.title} className="border-t-2 border-emerald-800 pt-6">
              <p
                className="text-[10px] tracking-[0.18em] uppercase text-emerald-800 mb-3"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                {String(i + 1).padStart(2, '0')} · {f.tag}
              </p>
              <h3
                className="text-2xl text-stone-900 leading-snug mb-3"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
              >
                {f.title}
              </h3>
              <p className="text-[15px] text-stone-700 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ───────────────────────────────────────────────────────────────────────────
//  Section 5 — PRICING
// ───────────────────────────────────────────────────────────────────────────

function PricingSection({ currency }: { currency: 'NPR' | 'USD' }) {
  return (
    <section id="pricing" className="bg-white border-y border-stone-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="text-center max-w-2xl mx-auto mb-10 lg:mb-14">
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-stone-500 mb-2"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            §03 — Pricing
          </p>
          <h2
            className="text-3xl lg:text-4xl text-stone-900 tracking-tight leading-tight mb-3"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
          >
            One Solo plan pays back on the first DFS.
          </h2>
          <p className="text-stone-600 text-base">
            Consultancies charge NPR 600,000–1,200,000 per DFS. HydroStack is a
            fraction of one. Free during beta — sign up to lock in beta pricing.
          </p>
        </div>

        <PricingTiers currency={currency} />
      </div>
    </section>
  )
}

// ───────────────────────────────────────────────────────────────────────────
//  Section 6 — TESTIMONIAL
// ───────────────────────────────────────────────────────────────────────────

function TestimonialSection() {
  return (
    <section className="bg-stone-50">
      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28 text-center">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-stone-500 mb-8"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          §04 — Senior checker review
        </p>
        <blockquote>
          <p
            className="text-2xl lg:text-3xl text-stone-800 leading-[1.4] italic"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 400 }}
          >
            &ldquo;The hard part — complex fluid dynamics, twelve-force structural
            iterations, water-hammer physics, financial modelling — is one hundred
            percent correct.&rdquo;
          </p>
          <footer className="mt-7 flex flex-col items-center gap-1">
            <span className="block w-12 h-px bg-stone-400 mb-3" />
            <p
              className="text-[12px] tracking-[0.16em] uppercase text-stone-600"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Senior checker
            </p>
            <p className="text-[13px] text-stone-500">
              40 years in Nepali hydropower engineering
            </p>
          </footer>
        </blockquote>

        {/* Closing CTA */}
        <div className="mt-14 pt-14 border-t border-stone-200">
          <p
            className="text-[11px] tracking-[0.2em] uppercase text-stone-500 mb-4"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Ready when you are
          </p>
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
    </section>
  )
}