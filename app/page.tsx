import Link from 'next/link'
import WaitlistForm from '@/components/WaitlistForm'
import Navbar from '@/components/landing/Navbar'
import HydropowerSchematic from '@/components/landing/HydropowerSchematic'

export default function Home() {
  return (
    <main className="bg-stone-50 text-stone-900 min-h-screen antialiased">
      <Navbar />

      {/* ───── HERO ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Subtle drafting grid on the hero */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-12 lg:pt-20 pb-20 lg:pb-28">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left — copy */}
            <div className="lg:col-span-7">
              <div
                className="text-[11px] tracking-[0.2em] text-emerald-800 mb-8 uppercase font-medium"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                AEPC&nbsp;Ref.&nbsp;Std.&nbsp;2014 &nbsp;·&nbsp; IS&nbsp;5330 &nbsp;·&nbsp; IS&nbsp;11625 &nbsp;·&nbsp; IS&nbsp;11639
              </div>

              <h1
                className="text-5xl sm:text-6xl lg:text-[5.5rem] leading-[0.98] tracking-tight text-stone-900 mb-8"
                style={{
                  fontFamily: 'var(--font-display), Georgia, serif',
                  fontFeatureSettings: '"ss01", "ss02"',
                  fontWeight: 500,
                }}
              >
                The end of the
                <br />
                <span className="italic text-emerald-800" style={{ fontWeight: 400 }}>
                  thirteen-year-old
                </span>{' '}
                Excel.
              </h1>

              <p className="text-xl text-stone-700 leading-relaxed max-w-2xl mb-6">
                HydroStack is a complete design workbench for mini and micro hydropower
                in Nepal. Hydrology, intake, penstock, anchor blocks, energy table,
                financial model — every AEPC typical, generated in one flow.
              </p>

              <p className="text-base text-stone-600 max-w-2xl mb-10 leading-relaxed">
                Submit your DFS in under an hour, not three weeks. Built by a practising
                hydropower engineer for the engineers who carry this country's renewable
                targets on their backs.
              </p>

              <WaitlistForm />

              <div
                className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-stone-600"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                  Built in Kathmandu
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                  AEPC + DoED submission ready
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                  NPR / USD pricing
                </span>
              </div>
            </div>

            {/* Right — schematic in title-block frame */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-stone-300 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]">
                {/* Title block top */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 border-b border-stone-300 bg-stone-50"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  <span className="text-[10px] tracking-[0.18em] uppercase text-stone-700 font-medium">
                    Drawing&nbsp;HS-001 / Typical Layout
                  </span>
                  <span className="text-[10px] tracking-[0.1em] text-stone-500">SCALE: NTS</span>
                </div>

                <div className="p-3 sm:p-5">
                  <HydropowerSchematic />
                </div>

                {/* Title block bottom */}
                <div
                  className="grid grid-cols-3 border-t border-stone-300 text-[10px] tracking-[0.12em] uppercase text-stone-700"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  <div className="px-4 py-2 border-r border-stone-300">
                    <span className="text-stone-500 mr-2">SHEET</span>1/15
                  </div>
                  <div className="px-4 py-2 border-r border-stone-300 text-center">
                    <span className="text-stone-500 mr-2">REV.</span>1.0
                  </div>
                  <div className="px-4 py-2 text-right text-emerald-800">RUN-OF-RIVER</div>
                </div>
              </div>

              <p
                className="mt-3 text-[11px] text-stone-500 tracking-[0.06em]"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                FIG.&nbsp;1 — Side elevation. All 15 AEPC typicals included.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── BY THE NUMBERS ───────────────────────────────── */}
      <section className="border-y border-stone-300 bg-stone-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 lg:py-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {[
              { value: '< 60', unit: 'min', label: 'DFS preparation, end to end' },
              { value: '15', unit: 'typicals', label: 'AEPC drawings auto-generated' },
              { value: '8', unit: 'modules', label: 'Hydrology to financial model' },
              { value: '1.5', unit: '%', label: 'Of one DFS consultancy fee' },
            ].map(({ value, unit, label }) => (
              <div key={label} className="border-l-2 border-emerald-700 pl-5">
                <div
                  className="text-[10px] tracking-[0.2em] text-emerald-800 uppercase mb-2 font-medium"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  {unit}
                </div>
                <div
                  className="text-5xl lg:text-6xl text-stone-900 leading-none mb-3"
                  style={{
                    fontFamily: 'var(--font-display), Georgia, serif',
                    fontWeight: 500,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {value}
                </div>
                <div className="text-sm text-stone-600 leading-snug max-w-[180px]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── §1 THE PROBLEM ───────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <SectionMark mark="§1" label="The problem" />
        <h2
          className="text-3xl lg:text-5xl leading-[1.05] tracking-tight text-stone-900 mb-14 max-w-4xl"
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}
        >
          You have done this <em className="italic text-emerald-800" style={{ fontWeight: 400 }}>a hundred times</em>.
          The tools have not changed.
        </h2>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Today */}
          <article className="bg-white border border-stone-300 p-8 lg:p-10">
            <div
              className="text-[10px] tracking-[0.2em] text-stone-500 uppercase mb-5 font-medium"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Today&nbsp;·&nbsp;The Status Quo
            </div>
            <div
              className="text-2xl lg:text-3xl mb-7 text-stone-900 leading-tight"
              style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
            >
              Chitrakar Excel{' '}
              <span className="text-stone-400">+</span> AutoCAD
            </div>
            <ul className="space-y-4 text-stone-700">
              {[
                'A 13-year-old spreadsheet, brittle formulas, no version history',
                'Re-draw the same 15 typicals in AutoCAD for every project',
                'Copy-paste numbers between hydrology, energy, and financial sheets',
                'Format the DFS PDF by hand — three weeks per submission',
                'One mistake in the penstock surge calc, you find it on page 84',
              ].map((line) => (
                <li key={line} className="flex gap-3 leading-relaxed">
                  <span className="text-stone-400 select-none mt-1.5">—</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* HydroStack */}
          <article className="bg-emerald-950 text-emerald-50 p-8 lg:p-10 relative overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="relative">
              <div
                className="text-[10px] tracking-[0.2em] text-emerald-400 uppercase mb-5 font-medium"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                With HydroStack
              </div>
              <div
                className="text-2xl lg:text-3xl mb-7 text-white leading-tight"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
              >
                One workbench. One PDF.
              </div>
              <ul className="space-y-4 text-emerald-100">
                {[
                  'Enter survey data once — every module updates downstream',
                  'All 15 AEPC typicals exported as editable DXF files',
                  'Q40, Q80, IRR, NPV, LCoE — calculated to AEPC 2014 spec',
                  'DFS PDF in AEPC chapter format, ready for submission',
                  'Version history. If something breaks, you see exactly when.',
                ].map((line) => (
                  <li key={line} className="flex gap-3 leading-relaxed">
                    <span className="text-emerald-400 select-none mt-1">→</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </section>

      {/* ───── §2 THE WORKBENCH ─────────────────────────────── */}
      <section id="workflow" className="bg-stone-100 border-y border-stone-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <SectionMark mark="§2" label="The workbench" />
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 mb-14">
            <h2
              className="lg:col-span-7 text-3xl lg:text-5xl leading-[1.05] tracking-tight text-stone-900"
              style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500, letterSpacing: '-0.02em' }}
            >
              Eight modules.<br /> One project file.
            </h2>
            <p className="lg:col-span-5 text-lg text-stone-600 leading-relaxed lg:pt-3">
              Every calculation traceable to AEPC 2014 or the relevant Indian Standard.
              No black boxes. Open the formula, see the source, verify the result.
            </p>
          </div>

          <div className="bg-white border border-stone-300">
            {[
              {
                num: '01',
                name: 'Hydrology',
                spec: 'AEPC §3.1 · MIP method',
                detail:
                  'Q40, Q80, Qmean, 100-year flood. Salt-dilution input or regression for ungauged streams.',
              },
              {
                num: '02',
                name: 'Intake & Settling Basin',
                spec: 'AEPC §4.2',
                detail:
                  '0.2 mm grain (>100 m head) or 0.3 mm (<100 m). Auto-sized basin dimensions per AEPC standard.',
              },
              {
                num: '03',
                name: 'Headrace & Forebay',
                spec: 'IS 7986 · Manning',
                detail:
                  "Manning's n library for lined and unlined channels, HDPE / steel pipe alternatives.",
              },
              {
                num: '04',
                name: 'Penstock',
                spec: 'IS 11625 · IS 11639',
                detail:
                  'Material selection, thickness per code, surge analysis, Joukowsky pressure check.',
              },
              {
                num: '05',
                name: 'Anchor Blocks',
                spec: 'IS 5330:1984',
                detail:
                  'Bearing, sliding, overturning checks. Dead weight, hydrostatic thrust, seismic per IS 1893.',
              },
              {
                num: '06',
                name: 'Powerhouse & Turbine',
                spec: 'AEPC §6',
                detail:
                  'Pelton / Crossflow / Turgo / Francis selection by head and flow envelope. Generator sizing.',
              },
              {
                num: '07',
                name: 'Energy Table',
                spec: 'Monthly · GWh',
                detail:
                  'English and Nepali calendar months (Baisakh–Chaitra). Plant factor and annual energy.',
              },
              {
                num: '08',
                name: 'Financial Model',
                spec: 'IRR · NPV · LCoE',
                detail:
                  'CapEx library seeded from Butchers et al. 2022 + your own historical project rates.',
              },
            ].map(({ num, name, spec, detail }, i, arr) => (
              <div
                key={num}
                className={`grid grid-cols-12 gap-4 lg:gap-6 px-6 lg:px-8 py-6 ${
                  i !== arr.length - 1 ? 'border-b border-stone-200' : ''
                } hover:bg-stone-50 transition-colors`}
              >
                <div
                  className="col-span-2 lg:col-span-1 text-emerald-800 text-sm pt-1 font-medium"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  {num}
                </div>
                <div className="col-span-10 lg:col-span-11">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-1.5 gap-2">
                    <h3
                      className="text-xl lg:text-2xl text-stone-900"
                      style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
                    >
                      {name}
                    </h3>
                    <span
                      className="text-[10px] tracking-[0.18em] uppercase text-stone-500"
                      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                    >
                      {spec}
                    </span>
                  </div>
                  <p className="text-[15px] text-stone-600 leading-relaxed max-w-3xl">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── §3 PRICING ───────────────────────────────────── */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <SectionMark mark="§3" label="Rate card" />
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 mb-14">
          <h2
            className="lg:col-span-7 text-3xl lg:text-5xl leading-[1.05] tracking-tight text-stone-900"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            One software,<br /> less than <em className="italic text-emerald-800" style={{ fontWeight: 400 }}>one DFS</em>.
          </h2>
          <p className="lg:col-span-5 text-lg text-stone-600 leading-relaxed lg:pt-3">
            A standard mini-hydro DFS consultancy fee in Nepal sits between{' '}
            <span
              className="text-stone-900 font-medium"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              NPR&nbsp;600,000–1,200,000
            </span>
            . Your annual subscription is roughly 1.5% of that.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Solo */}
          <article className="bg-white border border-stone-300 p-8 flex flex-col">
            <div
              className="flex items-center justify-between mb-1 text-[10px] tracking-[0.2em] uppercase text-stone-500 font-medium"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <span>Plan&nbsp;A</span>
              <span>Solo</span>
            </div>
            <div className="border-b border-stone-200 mb-6 pb-5">
              <div className="flex items-baseline gap-2 mt-4">
                <span
                  className="text-5xl text-stone-900"
                  style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500, letterSpacing: '-0.03em' }}
                >
                  NPR&nbsp;2,500
                </span>
                <span className="text-stone-500 text-sm">/&nbsp;mo</span>
              </div>
              <div
                className="text-stone-500 text-sm mt-1"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                or NPR 25,000 / yr
              </div>
            </div>
            <ul className="space-y-3 text-[15px] text-stone-700 mb-8 flex-1">
              <PlanItem>10 active projects</PlanItem>
              <PlanItem>Full PDF + DXF export</PlanItem>
              <PlanItem>1 seat</PlanItem>
              <PlanItem>Email support</PlanItem>
            </ul>
            <Link
              href="/login"
              className="block text-center px-5 py-3 border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-stone-50 transition-colors text-sm font-medium tracking-wide"
            >
              Get started
            </Link>
          </article>

          {/* Studio (popular) */}
          <article className="bg-emerald-950 border border-emerald-950 text-emerald-50 p-8 flex flex-col relative">
            <div className="absolute -top-px left-0 right-0 h-px bg-emerald-400" />
            <div
              className="flex items-center justify-between mb-1 text-[10px] tracking-[0.2em] uppercase text-emerald-400 font-medium"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <span>Plan&nbsp;B</span>
              <span className="bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-sm">Most&nbsp;popular</span>
            </div>
            <div className="border-b border-emerald-800 mb-6 pb-5">
              <div className="flex items-baseline gap-2 mt-4">
                <span
                  className="text-5xl text-white"
                  style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500, letterSpacing: '-0.03em' }}
                >
                  NPR&nbsp;9,000
                </span>
                <span className="text-emerald-300 text-sm">/&nbsp;mo</span>
              </div>
              <div
                className="text-emerald-300 text-sm mt-1"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                or NPR 90,000 / yr
              </div>
            </div>
            <ul className="space-y-3 text-[15px] text-emerald-100 mb-8 flex-1">
              <PlanItem dark>Unlimited projects</PlanItem>
              <PlanItem dark>PDF + DXF + Excel export</PlanItem>
              <PlanItem dark>5 seats</PlanItem>
              <PlanItem dark>Version history</PlanItem>
              <PlanItem dark>Priority support</PlanItem>
            </ul>
            <Link
              href="/login"
              className="block text-center px-5 py-3 bg-emerald-400 text-emerald-950 hover:bg-emerald-300 transition-colors text-sm font-semibold tracking-wide"
            >
              Get started
            </Link>
          </article>

          {/* Enterprise */}
          <article className="bg-white border border-stone-300 p-8 flex flex-col">
            <div
              className="flex items-center justify-between mb-1 text-[10px] tracking-[0.2em] uppercase text-stone-500 font-medium"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <span>Plan&nbsp;C</span>
              <span>Enterprise</span>
            </div>
            <div className="border-b border-stone-200 mb-6 pb-5">
              <div className="flex items-baseline gap-2 mt-4">
                <span
                  className="text-5xl text-stone-900"
                  style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500, letterSpacing: '-0.03em' }}
                >
                  NPR&nbsp;25,000
                </span>
                <span className="text-stone-500 text-sm">/&nbsp;mo</span>
              </div>
              <div
                className="text-stone-500 text-sm mt-1"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                or NPR 250,000 / yr
              </div>
            </div>
            <ul className="space-y-3 text-[15px] text-stone-700 mb-8 flex-1">
              <PlanItem>Unlimited projects</PlanItem>
              <PlanItem>20 seats + SSO</PlanItem>
              <PlanItem>API access</PlanItem>
              <PlanItem>White-label DFS reports</PlanItem>
              <PlanItem>Dedicated onboarding</PlanItem>
            </ul>
            <Link
              href="mailto:info@usehydrostack.com"
              className="block text-center px-5 py-3 border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-stone-50 transition-colors text-sm font-medium tracking-wide"
            >
              Contact sales
            </Link>
          </article>
        </div>

        <p
          className="mt-8 text-[12px] text-stone-500 tracking-wide max-w-3xl"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          NOTE — All plans include AEPC 2014 compliance, IS-code reference library, and submission-ready DFS export. USD pricing available for international consultants.
        </p>
      </section>

      {/* ───── §4 BUILT BY ──────────────────────────────────── */}
      <section className="bg-stone-900 text-stone-100 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <div
                className="text-[10px] tracking-[0.2em] text-emerald-400 uppercase mb-4 font-medium"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                §4&nbsp;&nbsp;·&nbsp;&nbsp;Built by an engineer
              </div>
              <p className="text-stone-400 text-sm leading-relaxed">
                HydroStack is not built by a startup that read a Wikipedia article on hydropower.
                It is built by an engineer who has lived the problem.
              </p>
            </div>
            <div className="lg:col-span-8">
              <blockquote
                className="text-2xl sm:text-3xl lg:text-[2.4rem] leading-[1.2] text-white mb-10"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 400 }}
              >
                <span className="text-emerald-400">&ldquo;</span>I designed the Shyam Khola HPP, 7.2 MW.
                I have spent more nights reformatting Excel tabs than I have spent designing penstocks.
                HydroStack is the tool I wish I had on day one.<span className="text-emerald-400">&rdquo;</span>
              </blockquote>
              <div className="border-t border-stone-700 pt-6 grid sm:grid-cols-2 gap-4">
                <div>
                  <div
                    className="text-emerald-400 text-sm mb-1 font-medium"
                    style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                  >
                    — Angel Mainali, Civil Engineer
                  </div>
                  <div
                    className="text-stone-500 text-[12px]"
                    style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                  >
                    IWA-published&nbsp;·&nbsp;Founder, HydroStack
                  </div>
                </div>
                <div className="sm:text-right">
                  <div
                    className="text-stone-400 text-[12px]"
                    style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                  >
                    Project: Shyam Khola HPP
                  </div>
                  <div
                    className="text-stone-400 text-[12px]"
                    style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                  >
                    Capacity: 7.2 MW · Run-of-river
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── FINAL CTA ────────────────────────────────────── */}
      <section className="bg-stone-50 border-b border-stone-300">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-20 lg:py-28 text-center">
          <SectionMark mark="§5" label="Get access" centered />
          <h2
            className="text-3xl lg:text-5xl leading-[1.05] tracking-tight text-stone-900 mb-6"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            Stop redrawing typicals.<br />
            <em className="italic text-emerald-800" style={{ fontWeight: 400 }}>Start designing again.</em>
          </h2>
          <p className="text-lg text-stone-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            HydroStack is in private beta. The first cohort of consultants is being onboarded now. Join the waitlist.
          </p>
          <WaitlistForm />
          <p
            className="mt-6 text-[12px] text-stone-500 tracking-wide"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Already have an account?{' '}
            <Link href="/login" className="underline decoration-emerald-700 decoration-2 underline-offset-4 hover:text-emerald-800">
              Sign in →
            </Link>
          </p>
        </div>
      </section>

      {/* ───── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-stone-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
          <div className="grid lg:grid-cols-4 gap-10 mb-12">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-emerald-800 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-emerald-100">
                    <path
                      d="M12 2 L12 8 M12 8 L7 14 C7 18 9 22 12 22 C15 22 17 18 17 14 L12 8 Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span
                  className="font-medium text-stone-900 text-lg"
                  style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
                >
                  HydroStack
                </span>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed">
                The design workbench for mini and micro hydropower in Nepal.
              </p>
            </div>

            <FooterCol title="Standards">
              <li>AEPC Reference Std. 2014</li>
              <li>IS&nbsp;5330:1984</li>
              <li>IS&nbsp;11625:1986</li>
              <li>IS&nbsp;11639 (Parts 1–3)</li>
              <li>MNRE / AHEC-IITR</li>
            </FooterCol>

            <FooterCol title="Product">
              <li>
                <Link href="#workflow" className="hover:text-emerald-800">Workflow</Link>
              </li>
              <li>
                <Link href="#pricing" className="hover:text-emerald-800">Pricing</Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-emerald-800">Sign in</Link>
              </li>
            </FooterCol>

            <FooterCol title="Contact">
              <li>info@usehydrostack.com</li>
              <li>Kathmandu, Nepal</li>
              <li className="pt-2 text-stone-700">Built by Angel Mainali</li>
            </FooterCol>
          </div>

          <div
            className="pt-6 border-t border-stone-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-stone-500 tracking-[0.06em]"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            <div>© 2026 HYDROSTACK · ALL RIGHTS RESERVED</div>
            <div>VER. 1.0 · USEHYDROSTACK.COM</div>
          </div>
        </div>
      </footer>
    </main>
  )
}

// ─────── Helper components ─────────────────────────────────

function SectionMark({ mark, label, centered }: { mark: string; label: string; centered?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 mb-6 text-[10px] tracking-[0.22em] uppercase text-emerald-800 font-medium ${
        centered ? 'justify-center' : ''
      }`}
      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
    >
      <span className="text-stone-400">{mark}</span>
      <span className="w-6 h-px bg-stone-400" />
      <span>{label}</span>
    </div>
  )
}

function PlanItem({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <li className="flex gap-2.5">
      <span className={`mt-1 ${dark ? 'text-emerald-400' : 'text-emerald-700'}`} aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  )
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[10px] tracking-[0.22em] uppercase text-stone-500 mb-3 font-medium"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        {title}
      </div>
      <ul className="space-y-2 text-sm text-stone-600">{children}</ul>
    </div>
  )
}