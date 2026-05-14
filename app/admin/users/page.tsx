import { createAdminClient } from '@/lib/supabase/admin'
import { UsersTable, type UserRow } from './_components/users-table'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const admin = createAdminClient()

  // Profiles
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select(
  'id, full_name, pan_number, plan, subscription_status, project_limit, plan_activated_at, plan_note, updated_at',
)
    .order('updated_at', { ascending: false })

  if (profileError) {
    return (
      <div className="rounded-sm border border-red-300 bg-red-50 p-4 font-mono text-sm text-red-900">
        Error loading profiles: {profileError.message}
      </div>
    )
  }

  const profileList = profiles ?? []
  const ids = profileList.map((p) => p.id)

  // Project counts — fetch all and group client-side (simpler than RPC for <50 users)
  const projectCounts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: projects } = await admin
      .from('projects')
      .select('created_by')
      .in('created_by', ids)
    for (const row of projects ?? []) {
      const k = (row as { created_by: string }).created_by
      projectCounts.set(k, (projectCounts.get(k) ?? 0) + 1)
    }
  }

  // Emails from auth.users
  const { data: authData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  })
  const emailById = new Map<string, string>()
  for (const u of authData?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email)
  }

  const rows: UserRow[] = profileList.map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? '—',
    fullName: p.full_name,
    panNumber: p.pan_number,
    plan: p.plan,
    subscriptionStatus: p.subscription_status,
    projectLimit: p.project_limit,
    planActivatedAt: p.plan_activated_at,
    planNote: p.plan_note,
    updatedAt: p.updated_at,
    projectCount: projectCounts.get(p.id) ?? 0,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-stone-900">Users</h1>
        <p className="font-mono text-xs text-stone-500 mt-1">
          {rows.length} total · Activate plans manually after payment confirmation
        </p>
      </div>

      <UsersTable initialRows={rows} />
    </div>
  )
}