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
    return <UpgradeWall plan={limit.plan} current={limit.currentCount} limit={limit.limit} />
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-serif text-3xl text-stone-900">New project</h1>
      <p className="mt-1 font-mono text-xs text-stone-500">
        {limit.plan === 'beta'
          ? 'Beta access — unlimited projects'
          : `${limit.currentCount} of ${limit.limit} projects used`}
      </p>
      <div className="mt-8">
        <NewProjectForm />
      </div>
    </div>
  )
}

function UpgradeWall({
  plan,
  current,
  limit,
}: {
  plan: string
  current: number
  limit: number
}) {
  const upgrades = getUpgradeOptions(plan).slice(0, 2) // show up to 2 options
  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <div className="rounded-sm border-l-4 border-amber-500 bg-stone-50 p-8">
        <p className="font-mono text-xs uppercase tracking-wider text-amber-800">
          Project limit reached
        </p>
        <h1 className="mt-2 font-serif text-2xl text-stone-900">
          You&apos;ve used {current} of {limit} projects on the {getPlanLabel(plan)} plan
        </h1>
        <p className="mt-3 font-mono text-sm text-stone-700">
          To create more projects, upgrade your plan.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {upgrades.map((p, idx) => (
            <Link
              key={p}
              href={`/subscribe/${p}`}
              className={
                idx === 0
                  ? 'rounded-sm bg-emerald-800 px-5 py-2.5 font-mono text-xs text-white hover:bg-emerald-900'
                  : 'rounded-sm border border-stone-400 bg-white px-5 py-2.5 font-mono text-xs text-stone-900 hover:bg-stone-50'
              }
            >
              Subscribe to {getPlanLabel(p)} →
            </Link>
          ))}
        </div>

        <p className="mt-6 border-t border-stone-200 pt-4 font-mono text-xs text-stone-500">
          Already paid? Your plan will be activated within 24 hours after sending your screenshot.
        </p>

        <div className="mt-4">
          <Link
            href="/projects"
            className="font-mono text-xs text-stone-500 hover:text-stone-800"
          >
            ← Back to projects
          </Link>
        </div>
      </div>
    </div>
  )
}