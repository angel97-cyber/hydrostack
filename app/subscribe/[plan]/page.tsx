import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS, isPaidPlan, type PlanName } from '@/lib/billing/plans'
import { NotifyButton } from './_notify-button'
import { ContactButtons } from './_contact-buttons'

export const dynamic = 'force-dynamic'

export default async function SubscribePage({ params }: { params: Promise<{ plan: string }> }) {
  const { plan: planParam } = await params
  if (!(planParam in PLAN_LIMITS) || !isPaidPlan(planParam)) redirect('/pricing')

  const plan = planParam as PlanName
  const planConfig = PLAN_LIMITS[plan]
  const price = planConfig.priceNPR!
  const label = planConfig.label

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?mode=signup&next=/subscribe/${plan}`)

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single()

  const userEmail = user.email ?? ''
  const userName = profile?.full_name ?? ''
  const whatsapp = process.env.PAYMENT_WHATSAPP ?? ''
  const viber = process.env.PAYMENT_VIBER ?? ''
  const priceFormatted = price.toLocaleString()

  const waText =
    `Hi Angel, I want to subscribe to HydroStack ${label} (NPR ${priceFormatted}/mo).\n` +
    `My registered email: ${userEmail}\nPayment screenshot attached.`
  const waUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(waText)}`
  const viberUrl = `viber://chat?number=${viber}`

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 border-b border-stone-300 pb-6">
          <p className="font-mono text-xs uppercase tracking-wider text-stone-500">Subscribe</p>
          <h1 className="mt-1 font-serif text-3xl text-stone-900">Subscribe to {label}</h1>
          <p className="mt-2 font-mono text-lg text-emerald-800">NPR {priceFormatted} / month</p>
        </div>

        <div className="rounded-sm border border-stone-300 bg-white p-6 font-mono text-sm text-stone-800">
          <p className="mb-4"><span className="font-semibold text-stone-900">Step 1</span>{' — Scan the QR code below or pay to:'}</p>
          <ul className="ml-6 mb-5 space-y-1">
            <li>{'Bank: '}<span className="font-semibold text-stone-900">NIC Asia Bank</span></li>
            <li>{'Account Name: '}<span className="font-semibold text-stone-900">Angel Mainali</span></li>
            <li>{'Amount: '}<span className="font-semibold text-emerald-800">NPR {priceFormatted}</span></li>
          </ul>
          <p className="mb-5"><span className="font-semibold text-stone-900">Step 2</span>{' — Take a screenshot of the payment confirmation.'}</p>
          <p className="mb-2"><span className="font-semibold text-stone-900">Step 3</span>{' — Send the screenshot to Angel on WhatsApp or Viber.'}</p>
          <p className="ml-6 mb-5 text-stone-600">{'Include your registered email: '}<span className="font-semibold text-stone-900">{userEmail}</span></p>
          <p className="mb-2"><span className="font-semibold text-stone-900">Step 4</span>{' — Your plan will be activated within 24 hours.'}</p>
          <p className="ml-6 text-stone-600">{'You will receive a confirmation email at '}<span className="font-semibold text-stone-900">{userEmail}</span>.</p>
        </div>

        <div className="my-10 flex flex-col items-center">
          <div className="border border-stone-300 bg-white p-4">
            <Image src="/images/nic-asia-qr.png" alt="NIC Asia payment QR" width={280} height={280} priority={true} />
          </div>
          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-stone-500">NIC Asia Bank</p>
        </div>

        <ContactButtons waUrl={waUrl} viberUrl={viberUrl} />

        <div className="mt-8 rounded-sm border border-stone-200 bg-white p-5">
          <p className="font-mono text-xs text-stone-600">
            {'Already sent your screenshot? We will email you at '}
            <span className="font-semibold text-stone-900">{userEmail}</span>
            {' within 24 hours once your plan is active.'}
          </p>
          <div className="mt-4">
            <NotifyButton plan={plan} price={price} userEmail={userEmail} userName={userName} userId={user.id} />
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/pricing" className="font-mono text-xs text-stone-500 hover:text-stone-800">Back to pricing</Link>
        </div>
      </div>
    </div>
  )
}