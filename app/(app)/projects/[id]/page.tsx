import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Waves, FlaskConical, Zap, BarChart3, DollarSign,
  FileText, Droplets, CheckCircle2, Lock, MapPin, ChevronRight,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────────
// Module registry. `ready: true` modules link out to their page; others render
// as locked cards with the AEPC/IS reference shown for trust signals.
// ────────────────────────────────────────────────────────────────────────────
type ModuleDef = {
  id: string
  num: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
  cite: string
  ready: boolean
  href?: string
}

const modules = (projectId: string): ModuleDef[] => [
  {
    id: 'hydrology',
    num: '01',
    label: 'Hydrology',
    icon: Waves,
    desc: 'Q40 / Q80 / Qmean, design flood, gross & net head, installed capacity.',
    cite: 'AEPC §2.4',
    ready: true,
    href: `/projects/${projectId}/hydrology`,
  },
  {
    id: 'intake',
    num: '02',
    label: 'Intake & Settling Basin',
    icon: FlaskConical,
    desc: 'Camp settling criterion, Stokes Vs, Kirschmer rack losses. Grain size from AEPC DFS Table 3.1.',
    cite: 'AEPC DFS 2014 §3.3.4 · AHEC §8.8',
    ready: true,
    href: `/projects/${projectId}/intake`,
  },
  {
    id: 'headrace',
    num: '03',
    label: 'Headrace & Forebay',
    icon: Droplets,
    // ← CHANGED: ready: true + href added (was ready: false, no href)
    desc: "Manning's open-channel hydraulics, head loss chain, forebay storage and submergence, fine-rack design.",
    cite: 'AEPC DFS 2014 §3.3.5 · AHEC §8 · §9 · IS:11388',
    ready: true,
    href: `/projects/${projectId}/headrace`,
  },
  {
  id: 'penstock',
  num: '04',
  label: 'Penstock & Anchor Blocks',
  icon: Zap,
  desc: 'Pipe sizing, surge analysis, IS 5330 stability checks.',
  cite: 'IS 5330 · IS 11625',
  ready: true,
  href: `/projects/${projectId}/penstock`,
},
  {
    id: 'powerhouse',
    num: '05',
    label: 'Powerhouse & Turbine',
    icon: Zap,
    desc: 'Pelton / Crossflow / Turgo / Francis selection.',
    cite: 'AEPC §7',
    ready: false,
  },
  {
    id: 'energy',
    num: '06',
    label: 'Energy Table',
    icon: BarChart3,
    desc: 'Monthly GWh, plant factor, English + Nepali months.',
    cite: 'AEPC §2.4.6',
    ready: false,
  },
  {
    id: 'financial',
    num: '07',
    label: 'Financial Model',
    icon: DollarSign,
    desc: 'CapEx, OpEx, IRR, NPV, LCoE — NPR + USD.',
    cite: 'AHEC §1.6',
    ready: false,
  },
  {
    id: 'export',
    num: '08',
    label: 'Export DFS + DXF',
    icon: FileText,
    desc: 'AEPC 2014 PDF report + 5 typical DXF drawings.',
    cite: 'AEPC DFS 2014',
    ready: false,
  },
]

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, river, district, capacity_kw, standard, status')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const { data: completedModules } = await supabase
    .from('project_modules')
    .select('module, updated_at')
    .eq('project_id', project.id)

  const completed = new Map<string, string>(
    (completedModules ?? []).map((m: { module: string; updated_at: string }) => [m.module, m.updated_at])
  )
  const items = modules(project.id)
  const completedCount = items.filter((m) => completed.has(m.id)).length
  const progress = Math.round((completedCount / items.length) * 100)

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-6 lg:px-10">
          <Link
            href="/projects"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All projects
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div
                className="mb-2 text-[11px] uppercase tracking-[0.2em] text-emerald-800"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Project · {project.standard ?? 'AEPC DFS 2014'}
              </div>
              <h1
                className="text-3xl text-stone-900"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
              >
                {project.name}
              </h1>
              {(project.river || project.district) && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-stone-600">
                  <MapPin className="h-3.5 w-3.5" />
                  {[project.river, project.district].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div
              className="text-right text-[11px] uppercase tracking-[0.15em] text-stone-500"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <div>Status · {project.status}</div>
              {project.capacity_kw && <div>Target · {project.capacity_kw} kW</div>}
              <div className="mt-1 text-emerald-800">
                {completedCount}/{items.length} modules · {progress}%
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Module grid ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((m) => {
            const Icon = m.icon
            const done = completed.has(m.id)

            const Inner = (
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-stone-100 p-2 text-stone-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div
                        className="text-[10px] uppercase tracking-[0.2em] text-stone-400"
                        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                      >
                        Module {m.num}
                      </div>
                      <h3
                        className="text-lg text-stone-900"
                        style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
                      >
                        {m.label}
                      </h3>
                    </div>
                  </div>
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
                  ) : !m.ready ? (
                    <Lock className="h-4 w-4 shrink-0 text-stone-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
                  )}
                </div>
                <p className="mt-3 text-sm text-stone-600">{m.desc}</p>
                <div
                  className="mt-3 text-[10px] uppercase tracking-widest text-stone-400"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  {m.cite}
                </div>
              </div>
            )

            if (m.ready && m.href) {
              return (
                <Link
                  key={m.id}
                  href={m.href}
                  className="block rounded-md border border-stone-200 bg-white p-6 transition hover:border-emerald-600 hover:shadow-sm"
                >
                  {Inner}
                </Link>
              )
            }
            return (
              <div
                key={m.id}
                className="cursor-not-allowed rounded-md border border-stone-200 bg-stone-50 p-6 opacity-60"
              >
                {Inner}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}