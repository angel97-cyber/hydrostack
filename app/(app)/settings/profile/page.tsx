import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from './profile-form'

export const dynamic = 'force-dynamic'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // The handle_new_user() trigger guarantees a row exists, but fall back
  // gracefully in case the migration hasn't been applied yet.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, firm_name, nec_reg_no, designation, phone, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div>
      <header className="mb-8 pb-6 border-b border-stone-200">
        <h2
          className="text-2xl text-stone-900 leading-tight mb-1"
          style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
        >
          Engineer profile
        </h2>
        <p className="text-[14px] text-stone-600 max-w-lg">
          These details populate the cover page of every DFS report you export.
          Fill them in once — they appear on every Word document until you change them.
        </p>
      </header>

      <ProfileForm
        userEmail={user.email ?? ''}
        initial={{
          full_name:   profile?.full_name   ?? '',
          firm_name:   profile?.firm_name   ?? '',
          nec_reg_no:  profile?.nec_reg_no  ?? '',
          designation: profile?.designation ?? '',
          phone:       profile?.phone       ?? '',
        }}
        updatedAt={profile?.updated_at ?? null}
      />
    </div>
  )
}