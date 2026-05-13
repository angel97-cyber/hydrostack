import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { checkProjectLimit } from '@/lib/billing/check-project-limit'
import { getPlanLabel, getUpgradeOptions } from '@/lib/billing/plans'
import { NewProjectForm } from './_form'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const limit = await checkProjectLimit(user.id, supabase)

  if (!limit.allowed) {
    const upgrades = getUpgradeOptions(limit.plan).slice(0, 2)
    return (
      <div className="min-h-full bg-stone-50 flex items-start justify-center pt-24 px-6">
        <div className="max-w-lg w-full rounded-sm border-l-4 border-amber-500 bg-white p-8 shadow-sm">
          <p className="font-mono text-xs uppercase tracking-wider text-amber-800 mb-2">
            Project limit reached
          </p>
          <h1 className="font-serif text-2xl text-stone-900 mb-3">
            You have used {limit.currentCount} of {limit.limit} projects
            on the {getPlanLabel(limit.plan)} plan
          </h1>
          <p className="font-mono text-sm text-stone-600 mb-6">
            Upgrade your plan to create more projects.
          </p>
          <div className="flex flex-wrap gap-3">
            {upgrades.map((p, i) => (
              <Link
                key={p}
                href={`/subscribe/${p}`}
                className={i === 0
                  ? 'rounded-sm bg-emerald-800 px-5 py-2.5 font-mono text-xs text-white hover:bg-emerald-900'
                  : 'rounded-sm border border-stone-400 bg-white px-5 py-2.5 font-mono text-xs text-stone-900 hover:bg-stone-50'}
              >
                Subscribe to {getPlanLabel(p)}
              </Link>
            ))}
          </div>
          <p className="mt-6 border-t border-stone-100 pt-4 font-mono text-xs text-stone-400">
            Already paid? Your plan activates within 24 hours.
          </p>
        </div>
      </div>
    )
  }

  return <NewProjectForm />
}