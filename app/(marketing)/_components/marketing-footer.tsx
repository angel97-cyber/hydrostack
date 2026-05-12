import Link from 'next/link'

export default function MarketingFooter() {
  return (
    <footer className="bg-stone-900 text-stone-400 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="grid md:grid-cols-3 gap-8 md:gap-12 items-start">
          {/* Left — wordmark + by-line */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span
                aria-hidden
                className="w-7 h-7 bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-[11px] font-bold"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                HS
              </span>
              <span
                className="text-[17px] text-stone-50"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
              >
                HydroStack
              </span>
            </div>
            <p className="text-[13px] text-stone-500 leading-relaxed max-w-xs">
              By Angel Mainali, Nepal. Built by a practising hydropower engineer,
              not a software startup guessing at what engineers need.
            </p>
          </div>

          {/* Middle — links */}
          <div
            className="flex flex-wrap gap-x-6 gap-y-2 md:justify-center text-[13px]"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            <Link href="/pricing" className="hover:text-stone-50 transition-colors">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-stone-50 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-stone-50 transition-colors">
              Terms
            </Link>
            <a
              href="https://github.com/angel97-cyber/hydrostack"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-50 transition-colors"
            >
              GitHub
            </a>
          </div>

          {/* Right — standards citation */}
          <div className="md:text-right">
            <p
              className="text-[10px] tracking-[0.18em] uppercase text-stone-500 mb-2"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Standards cited
            </p>
            <p className="text-[12px] text-stone-400 leading-relaxed">
              AEPC DFS 2014 · IS 5330:1984 · IS 11625:1986 · IS 11639 Parts 1–3 ·
              IS 11388:1995 · AHEC-IITR
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-stone-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <p
            className="text-[11px] text-stone-500"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            © 2026 HydroStack · usehydrostack.com
          </p>
          <p
            className="text-[11px] text-stone-500"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Kathmandu, Nepal · Lat 27.7° N · Long 85.3° E
          </p>
        </div>
      </div>
    </footer>
  )
}