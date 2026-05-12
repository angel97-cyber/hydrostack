import Link from 'next/link'

export default function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 bg-stone-900 text-stone-100 border-b border-stone-800">
      <nav className="max-w-7xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
        {/* Logo wordmark */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span
            aria-hidden
            className="w-7 h-7 bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-[11px] font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            HS
          </span>
          <span
            className="text-[17px] tracking-tight text-stone-50"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
          >
            HydroStack
          </span>
          <span
            className="hidden sm:inline text-[10px] tracking-[0.18em] uppercase text-stone-400 border border-stone-700 px-1.5 py-0.5 ml-1"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Beta
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/pricing"
            className="hidden sm:inline text-[13px] text-stone-300 hover:text-stone-50 px-3 py-2 transition-colors"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-[13px] text-stone-300 hover:text-stone-50 px-3 py-2 transition-colors"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="text-[13px] bg-emerald-500 hover:bg-emerald-400 text-stone-900 font-medium px-3.5 py-2 transition-colors"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Start free →
          </Link>
        </div>
      </nav>
    </header>
  )
}