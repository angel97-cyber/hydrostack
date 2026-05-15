import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email/resend'

export const dynamic = 'force-dynamic'

const NEW_USER_WINDOW_MS = 3 * 60 * 1000 // 3 minutes

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Only new signups — existing users signing in are older than 3 min
  const ageMs = Date.now() - new Date(user.created_at).getTime()
  if (ageMs > NEW_USER_WINDOW_MS) {
    return NextResponse.json({ skipped: 'existing user' })
  }

  if (!user.email) {
    return NextResponse.json({ error: 'No email on user' }, { status: 400 })
  }

  try {
    await sendWelcomeEmail(user.email, user.user_metadata?.full_name ?? null)
    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error('[welcome] Resend failed:', err)
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }
}