'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkProjectLimit } from '@/lib/billing/check-project-limit'

export async function createProject(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated.' }

  // Belt-and-suspenders limit check (UI wall is in page.tsx; this guards direct calls)
  const limit = await checkProjectLimit(user.id, supabase)
  if (!limit.allowed) {
    return {
      error: `Project limit reached (${limit.currentCount} of ${limit.limit}). Upgrade at /settings/billing.`,
    }
  }

  const name = (formData.get('name') as string | null)?.trim()
  if (!name || name.length < 2) {
    return { error: 'Project name must be at least 2 characters.' }
  }

  const river      = (formData.get('river')    as string | null)?.trim() || null
  const district   = (formData.get('district') as string | null)?.trim() || null
  const capRaw     = (formData.get('capacity_kw') as string | null)?.trim()
  const capacity_kw = capRaw ? Number(capRaw) : null

  const { data: project, error: insertError } = await supabase
    .from('projects')
    .insert({
      name,
      river,
      district,
      capacity_kw,
      standard:   'AEPC DFS 2014',
      status:     'active',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !project) {
    console.error('[createProject]', insertError)
    return { error: insertError?.message ?? 'Failed to create project.' }
  }

  redirect(`/projects/${project.id}`)
}