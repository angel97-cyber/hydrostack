import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email/resend'

export async function GET(request: Request) {
  const requestUrl  = new URL(request.url)
  const code        = requestUrl.searchParams.get('code')
  const next        = requestUrl.searchParams.get('next') ?? '/projects'

  // Use the public site URL in production to avoid Vercel's internal proxy URLs
  const siteOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const createdAt  = new Date(user.created_at ?? 0).getTime()
        const lastSignIn = new Date(user.last_sign_in_at ?? 0).getTime()
        if (Math.abs(createdAt - lastSignIn) < 30_000) {
          const name =
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            null
          sendWelcomeEmail(user.email, name).catch((e) =>
            console.error('[welcome email]', e),
          )
        }
      }
      return NextResponse.redirect(`${siteOrigin}${next}`)
    }

    // Log the error so Vercel function logs show what went wrong
    console.error('[auth/callback] exchangeCodeForSession failed:', error)
  }

  return NextResponse.redirect(`${siteOrigin}/login?error=auth_callback_failed`)
}