import { ReactNode } from 'react'
import Link from 'next/link'

// ════════════════════════════════════════════════════════════════════════════
//  Settings layout
//  Renders inside (app)/layout.tsx — so the app sidebar already wraps this.
//  Adds a second-level nav on the left for Profile / Account / Billing.
// ════════════════════════════════════════════════════════════════════════════

const sections = [
  { label: 'Profile',  href: '/settings/profile',  enabled: true,  hint: 'NEC reg. + firm details for the DFS cover page' },
  { label: 'Account',  href: '/settings/account',  enabled: false, hint: 'Coming soon — email, password, sessions' },
  { label: 'Billing',  href: '/settings/billing',  enabled: true,  hint: 'Plan, project limit, upgrade options' },
]

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-full bg-stone-50"
      style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}
    >
      {/* Page header */}
      <div className="border-b border-stone-200 bg-white px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <p
            className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-1 font-medium"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Workspace
          </p>
          <h1
            className="text-3xl text-stone-900 leading-none"
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontWeight: 500,
              letterSpacing: '-0.02em',
            }}
          >
            Settings
          </h1>
        </div>
      </div>

      {/* Two-column body */}
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid lg:grid-cols-[220px_1fr] gap-10">
          {/* Section nav */}
          <nav>
            <ul className="space-y-1">
              {sections.map((s) =>
                s.enabled ? (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      className="block px-3 py-2 text-[14px] text-stone-900 hover:bg-white hover:border-stone-300 border border-transparent transition-colors"
                    >
                      {s.label}
                    </Link>
                  </li>
                ) : (
                  <li key={s.href}>
                    <div className="block px-3 py-2 text-[14px] text-stone-400 cursor-not-allowed select-none">
                      {s.label}
                      <span
                        className="block text-[10px] tracking-[0.18em] uppercase text-stone-400 mt-0.5"
                        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                      >
                        Coming soon
                      </span>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </nav>

          {/* Section content */}
          <div>{children}</div>
        </div>
      </div>
    </div>
  )
}