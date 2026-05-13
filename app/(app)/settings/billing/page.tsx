import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  PLAN_LIMITS,
  getPlanLabel,
  getUpgradeOptions,
  type PlanName,
} from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

const PLAN_BADGE: Record<string, string> = {
  beta:       'bg-stone-200 text-stone-900',
  student:    'bg-stone-200 text-stone-900',
  solo:       'bg-emerald-100 text-emerald-900',
  studio:     'bg-blue-100 text-blue-900',
  enterprise: 'bg-purple-100 text-purple-900',
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, subscription_status, project_limit, plan_activated_at, plan_note')
    .eq('id', user.id)
    .single()

  const plan = (profile?.plan ?? 'beta') as PlanName
  const projectLimit = profile?.project_limit ?? 999
  const limitDisplay  = projectLimit >= 999 ? '\u221e' : String(projectLimit)
  const activatedText = profile?.plan_activated_at
    ? new Date(profile.plan_activated_at).toLocaleDateString()
    : 'Beta access'
  const watermarkText = PLAN_LIMITS[plan]?.watermark ? 'Yes (Student)' : 'None'
  const badgeClass    = PLAN_BADGE[plan] ?? 'bg-stone-200 text-stone-900'

  const { count } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id)
  const usedProjects = count ?? 0

  const upgrades  = getUpgradeOptions(plan)
  const isTopTier = plan === 'studio' || plan === 'enterprise'

  return (
    <div className="space-y-10">

      {/* ── Current plan ── */}
      <section>
        <h2 className="font-serif text-2xl text-stone-900">Current plan</h2>
        <div className="mt-4 rounded-sm border border-stone-300 bg-white p-6">
          <div className="flex items-center gap-3">
            <span className={`inline-block rounded-sm px-2.5 py-1 font-mono text-xs uppercase tracking-wider ${badgeClass}`}>
              {getPlanLabel(plan)}
            </span>
            <span className="font-mono text-xs text-stone-500">
              {profile?.subscription_status ?? 'active'}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-4 font-mono text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wider text-stone-500">Projects</dt>
              <dd className="mt-1 text-stone-900">{usedProjects} of {limitDisplay}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-stone-500">Activated</dt>
              <dd className="mt-1 text-stone-900">{activatedText}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-stone-500">Watermark</dt>
              <dd className="mt-1 text-stone-900">{watermarkText}</dd>
            </div>
          </dl>

          {profile?.plan_note && (
            <p className="mt-4 border-t border-stone-100 pt-3 font-mono text-xs text-stone-500">
              Note: {profile.plan_note}
            </p>
          )}
        </div>
      </section>

      {/* ── Upgrade ── */}
      <section>
        <h2 className="font-serif text-2xl text-stone-900">Upgrade your plan</h2>
        <p className="mt-1 font-mono text-xs text-stone-500">
          Pay via NIC Asia QR. Plans activate within 24 hours.
        </p>

        {isTopTier && (
          <div className="mt-4 rounded-sm border border-stone-300 bg-white p-6 font-mono text-sm text-stone-700">
            <p>You are on our top tier.</p>
            <p className="mt-1">
              Contact us to discuss team or enterprise needs:{' '}
              <a href="mailto:angel@usehydrostack.com" className="text-emerald-800 hover:underline">
                angel@usehydrostack.com
              </a>
            </p>
          </div>
        )}

        {!isTopTier && upgrades.length === 0 && (
          <p className="mt-4 font-mono text-sm text-stone-500">No higher tier available.</p>
        )}

        {!isTopTier && upgrades.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {upgrades.map((p) => {
              const cfg       = PLAN_LIMITS[p]
              const priceText = cfg.priceNPR != null
                ? `NPR ${cfg.priceNPR.toLocaleString()} / mo`
                : 'Free'
              const limitText = cfg.projectLimit >= 999 ? 'Unlimited' : String(cfg.projectLimit)
              return (
                <div key={p} className="flex flex-col rounded-sm border border-stone-300 bg-white p-5">
                  <h3 className="font-serif text-lg text-stone-900">{cfg.label}</h3>
                  <p className="mt-1 font-mono text-emerald-800">{priceText}</p>
                  <p className="mt-3 font-mono text-xs text-stone-600">{limitText} projects</p>
                  <p className="font-mono text-xs text-stone-600">No watermark</p>
                  <Link
                    href={`/subscribe/${p}`}
                    className="mt-5 block rounded-sm bg-emerald-800 px-4 py-2 text-center font-mono text-xs text-white hover:bg-emerald-900"
                  >
                    Subscribe
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}