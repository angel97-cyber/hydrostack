'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getProjectLimit,
  isPaidPlan,
  PLAN_LIMITS,
  type PlanName,
} from '@/lib/billing/plans'
import { sendActivationEmail } from '@/lib/email/resend'

export async function activatePlan(
  userId: string,
  plan: PlanName,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  // 1. Verify caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return { ok: false, error: 'Forbidden' }
  }

  // 2. Validate plan
  if (!(plan in PLAN_LIMITS)) {
    return { ok: false, error: 'Invalid plan' }
  }
  const projectLimit = getProjectLimit(plan)

  // 3. Service role write (bypasses RLS)
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      plan,
      subscription_status: 'active',
      project_limit: projectLimit,
      plan_activated_at: new Date().toISOString(),
      plan_note: note.trim() || null,
    })
    .eq('id', userId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  // 4. Send activation email for paid plans only
  if (isPaidPlan(plan)) {
    const { data: targetUserData } = await admin.auth.admin.getUserById(userId)
    const targetEmail = targetUserData?.user?.email
    if (targetEmail) {
      await sendActivationEmail(targetEmail, plan, projectLimit)
    }
  }

  revalidatePath('/admin/users')
  return { ok: true }
}