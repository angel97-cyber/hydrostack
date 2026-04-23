import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppSidebar from '@/components/app/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen bg-[#0d1210] overflow-hidden">
      <AppSidebar user={user} profile={profile} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}