// Resend transactional email helpers. Plain text. Fire-and-forget at call sites.
// EMAIL_FROM env var lets you swap between Resend sandbox and your verified domain
// without redeploying. Sandbox: onboarding@resend.dev (always works). Verified
// domain: HydroStack <hello@usehydrostack.com> (set this once DNS propagates).

import { Resend } from 'resend'
import { getPlanLabel } from '@/lib/billing/plans'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'HydroStack <onboarding@resend.dev>'

function safeSend(payload: {
  to: string | string[]
  subject: string
  text: string
}) {
  return resend.emails
    .send({ from: FROM, ...payload })
    .catch((err) => {
      // Log but never throw — email failures must not break the user flow.
      console.error('[resend] send failed:', err)
    })
}

export async function sendWelcomeEmail(to: string, name?: string | null) {
  const greeting = name ? `Hi ${name}` : 'Hi Engineer'
  return safeSend({
    to,
    subject: 'Welcome to HydroStack — your DFS workspace is ready',
    text: [
      greeting + ',',
      '',
      'Your HydroStack account is live. During beta, everything is free and unrestricted.',
      '',
      'Start here:',
      '  · New project → usehydrostack.com/projects',
      '  · Complete your profile (for the DFS cover page) →',
      '    usehydrostack.com/settings/profile',
      '',
      'Modules covered: Hydrology (WECS/DHM), Intake, Headrace & Forebay,',
      'Penstock (IS 11639), Anchor Block (IS 5330:1984), Powerhouse,',
      'Energy Table, Financial Model (IRR/NPV/DSCR).',
      'Export: AEPC DFS 2014 Word document, ready for AEPC/DoED submission.',
      '',
      '— Angel Mainali',
      'Designer, Shyam Khola HPP · HydroStack',
      'angel@usehydrostack.com · usehydrostack.com',
    ].join('\n'),
  })
}

export async function sendPaymentNotificationToAdmin(params: {
  userEmail: string
  userName: string | null
  userId: string
  plan: string
  priceNPR: number
}) {
  const admin = process.env.ADMIN_EMAIL
  if (!admin) {
    console.error('[resend] ADMIN_EMAIL not set — payment notification skipped')
    return
  }
  const who = params.userName ?? params.userEmail
  return safeSend({
    to: admin,
    subject: `💰 HydroStack payment intent — ${params.userEmail} — ${params.plan}`,
    text: [
      `${who} wants to subscribe to ${getPlanLabel(params.plan)} (NPR ${params.priceNPR.toLocaleString()}/mo).`,
      '',
      `User email: ${params.userEmail}`,
      `User ID: ${params.userId}`,
      '',
      'Activate their plan:',
      'https://usehydrostack.com/admin/users',
      '',
      '(They will send you a payment screenshot on WhatsApp/Viber.)',
    ].join('\n'),
  })
}

export async function sendActivationEmail(
  to: string,
  plan: string,
  projectLimit: number,
) {
  const label = getPlanLabel(plan)
  const limitText = projectLimit >= 999 ? 'Unlimited' : String(projectLimit)
  return safeSend({
    to,
    subject: `HydroStack — your ${label} plan is now active`,
    text: [
      `Your HydroStack ${label} plan is now active.`,
      '',
      `Project limit: ${limitText}`,
      'Export: PDF + DOCX, no watermark',
      '',
      'Log in at: usehydrostack.com/projects',
      '',
      'Thank you for supporting HydroStack.',
      '— Angel Mainali',
    ].join('\n'),
  })
}