'use server'

import { createClient } from '@/lib/supabase/server'
import { sendPaymentNotificationToAdmin } from '@/lib/email/resend'
import { isPaidPlan, type PlanName } from '@/lib/billing/plans'

export async function notifyPaymentIntent(params: {
  plan: PlanName
  priceNPR: number
  userEmail: string
  userName: string | null
  userId: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== params.userId) {
    return { ok: false, error: 'Unauthorized' }
  }
  if (!isPaidPlan(params.plan)) {
    return { ok: false, error: 'Invalid plan' }
  }
  await sendPaymentNotificationToAdmin({
    userEmail: params.userEmail,
    userName: params.userName,
    userId: params.userId,
    plan: params.plan,
    priceNPR: params.priceNPR,
  })
  return { ok: true }
}