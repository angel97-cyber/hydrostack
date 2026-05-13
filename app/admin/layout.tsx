import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }
  if (user.email !== process.env.ADMIN_EMAIL) {
    redirect('/projects')
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-700 bg-stone-900 text-stone-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="font-serif text-lg">
            HydroStack <span className="font-mono text-xs text-stone-400">Admin</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="text-stone-400">{user.email}</span>
            <Link
              href="/projects"
              className="rounded-sm border border-stone-600 px-3 py-1 hover:bg-stone-800"
            >
              ← App
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}