'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Droplets,
  FolderOpen,
  LogOut,
  Settings,
  ChevronRight,
  Waves,
  FlaskConical,
  Zap,
  BarChart3,
  DollarSign,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

const navItems = [
  { href: '/projects', label: 'Projects', icon: FolderOpen },
]

const moduleItems = [
  { href: '#', label: 'Hydrology', icon: Waves, tag: 'Module 1' },
  { href: '#', label: 'Intake & Settling', icon: FlaskConical, tag: 'Module 2' },
  { href: '#', label: 'Headrace & Forebay', icon: Droplets, tag: 'Module 3' },
  { href: '#', label: 'Penstock & Anchor', icon: Zap, tag: 'Module 4' },
  { href: '#', label: 'Powerhouse', icon: Zap, tag: 'Module 5' },
  { href: '#', label: 'Energy Table', icon: BarChart3, tag: 'Module 6' },
  { href: '#', label: 'Financial Model', icon: DollarSign, tag: 'Module 7' },
  { href: '#', label: 'Export DFS PDF', icon: FileText, tag: 'Export' },
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
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <aside className="w-60 flex flex-col border-r border-white/[0.06] bg-[#0a0f0d]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/[0.06]">
        <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center shrink-0">
          <Droplets className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">HydroStack</span>
        <span className="ml-auto text-[10px] text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5 font-medium">MVP</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
              pathname === href
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}

        {/* Modules section */}
        <div className="pt-4 pb-1 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Design Modules</p>
        </div>

        {moduleItems.map(({ label, icon: Icon }) => (
          <button
            key={label}
            disabled
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/25 cursor-not-allowed"
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            <ChevronRight className="w-3 h-3 opacity-40" />
          </button>
        ))}

        <div className="pt-3 px-3">
          <p className="text-[9px] text-white/15 italic">Modules unlock when you open a project</p>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/[0.06] p-3 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-xs font-medium truncate">{displayName}</p>
            <p className="text-white/30 text-[10px] truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Link
            href="/app/settings"
            className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-white/40 hover:text-white/60 hover:bg-white/[0.04] text-xs transition-all"
          >
            <Settings className="w-3 h-3" />
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/[0.06] text-xs transition-all"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}