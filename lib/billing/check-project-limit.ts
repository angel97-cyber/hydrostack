import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProjectLimitResult {
  allowed: boolean
  currentCount: number
  limit: number
  plan: string
}

/**
 * Determines whether the user can create another project.
 * Beta users are never blocked (allowed = true regardless of count).
 * Reads profile.plan + profile.project_limit, counts projects via created_by.
 */
export async function checkProjectLimit(
  userId: string,
  supabase: SupabaseClient,
): Promise<ProjectLimitResult> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, project_limit')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    // No profile row yet (or transient error) — fail open for beta semantics.
    return { allowed: true, currentCount: 0, limit: 999, plan: 'beta' }
  }

  // Beta users always allowed
  if (profile.plan === 'beta') {
    return { allowed: true, currentCount: 0, limit: profile.project_limit, plan: 'beta' }
  }

  const { count, error: countError } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)

  if (countError) {
    // If we can't count, fail closed for paid plans (safer than letting them past).
    return { allowed: false, currentCount: 0, limit: profile.project_limit, plan: profile.plan }
  }

  const currentCount = count ?? 0
  return {
    allowed: currentCount < profile.project_limit,
    currentCount,
    limit: profile.project_limit,
    plan: profile.plan,
  }
}