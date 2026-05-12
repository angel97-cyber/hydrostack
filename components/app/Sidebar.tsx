'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Waves, FlaskConical, Droplets, Zap,
  BarChart3, DollarSign, FileText, FolderOpen,
  LogOut, Settings, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

const moduleItems = [
  { label: 'Hydrology', icon: Waves, spec: 'Q40 / Q80' },
  { label: 'Intake & Settling', icon: FlaskConical, spec: 'AEPC §4.2' },
  { label: 'Headrace & Forebay', icon: Droplets, spec: "Manning's n" },
  { label: 'Penstock & Anchor', icon: Zap, spec: 'IS 5330' },
  { label: 'Powerhouse', icon: Zap, spec: 'Turbine select' },
  { label: 'Energy Table', icon: BarChart3, spec: 'Monthly GWh' },
  { label: 'Financial Model', icon: DollarSign, spec: 'IRR / NPV' },
  { label: 'Export DFS', icon: FileText, spec: 'PDF + DXF' },
]

interface SidebarProps {
  user: User
  profile: { full_name?: string | null; organizations?: { name: string } } | null
}

export default function AppSidebar({ user, profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'Engineer'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isProjects = pathname === '/projects' || pathname.startsWith('/projects')

  return (
    <aside
      className="w-64 flex flex-col border-r border-stone-200 bg-stone-900"
      style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-stone-700/60">
        <div className="w-7 h-7 bg-emerald-700 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-emerald-100">
            <path
              d="M12 2 L12 8 M12 8 L7 14 C7 18 9 22 12 22 C15 22 17 18 17 14 L12 8 Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span
          className="text-stone-100 font-medium text-base tracking-tight"
          style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
        >
          HydroStack
        </span>
        <span
          className="ml-auto text-[9px] tracking-[0.15em] text-emerald-400 border border-emerald-700/50 px-1.5 py-0.5"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          BETA
        </span>
      </div>

      {/* ── Main nav ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        <Link
          href="/projects"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all rounded-none',
            isProjects && pathname === '/projects'
              ? 'bg-emerald-700/20 text-emerald-300 border-l-2 border-emerald-500'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 border-l-2 border-transparent'
          )}
        >
          <FolderOpen className="w-4 h-4 shrink-0" />
          Projects
        </Link>

        {/* ── Modules section ── */}
        <div className="pt-5 pb-2 px-3">
          <p
            className="text-[9px] tracking-[0.2em] uppercase text-stone-600 font-medium"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Design Modules
          </p>
        </div>

        {moduleItems.map(({ label, icon: Icon, spec }) => (
          <button
            key={label}
            disabled
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-600 cursor-not-allowed border-l-2 border-transparent"
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left text-[13px]">{label}</span>
            <span
              className="text-[9px] text-stone-700 tracking-wide hidden xl:block"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              {spec}
            </span>
            <ChevronRight className="w-3 h-3 opacity-30" />
          </button>
        ))}

        <div className="pt-4 px-3">
          <p
            className="text-[9px] italic text-stone-700"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Modules unlock inside a project
          </p>
        </div>
      </nav>

      {/* ── User footer ── */}
      <div className="border-t border-stone-700/60 p-3 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 bg-emerald-700 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-stone-300 text-xs font-medium truncate">{displayName}</p>
            <p
              className="text-stone-600 text-[10px] truncate"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <Link
            href="/settings/profile"
            className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-stone-500 hover:text-stone-300 hover:bg-stone-800/60 text-xs transition-all"
          >
            <Settings className="w-3 h-3" />
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-stone-500 hover:text-red-400 hover:bg-red-900/20 text-xs transition-all"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}