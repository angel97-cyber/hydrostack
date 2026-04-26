import Link from 'next/link'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-stone-50/85 backdrop-blur-md border-b border-stone-200">
      <nav className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-emerald-800 group-hover:bg-emerald-900 flex items-center justify-center transition-colors">
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
            className="font-medium text-stone-900 text-lg tracking-tight"
            style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
          >
            HydroStack
          </span>
          <span
            className="hidden sm:inline-block text-[10px] tracking-[0.18em] uppercase text-emerald-800 border border-emerald-800/30 px-1.5 py-0.5 ml-1"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Beta
          </span>
        </Link>

        {/* Center nav (desktop) */}
        <div
          className="hidden lg:flex items-center gap-9 text-[13px] text-stone-700"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          <a href="#workflow" className="hover:text-emerald-800 transition-colors tracking-[0.05em]">
            WORKFLOW
          </a>
          <a href="#pricing" className="hover:text-emerald-800 transition-colors tracking-[0.05em]">
            PRICING
          </a>
          <a href="#" className="hover:text-emerald-800 transition-colors tracking-[0.05em]">
            STANDARDS
          </a>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="text-sm text-stone-700 hover:text-stone-900 px-3 py-2 transition-colors font-medium"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="text-sm bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2 transition-colors font-medium tracking-wide"
          >
            Get access →
          </Link>
        </div>
      </nav>
    </header>
  )
}