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
    // ← CHANGED: ready: true + href added (was ready: false, no href)
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
    desc: "Manning's n library, head loss, forebay sizing.",
    cite: 'AEPC §5',
    ready: false,
  },
  {
    id: 'penstock',
    num: '04',
    label: 'Penstock & Anchor Blocks',
    icon: Zap,
    desc: 'Pipe sizing, surge analysis, IS 5330 stability checks.',
    cite: 'IS 5330 · IS 11625',
    ready: false,
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
    .select('*')
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
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-6">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 mb-3"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All projects
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div
                className="text-[11px] tracking-[0.2em] uppercase text-emerald-800 mb-2"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Project · {project.standard ?? 'AEPC_NP'}
              </div>
              <h1
                className="text-4xl lg:text-5xl text-stone-900 tracking-tight"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
              >
                {project.name}
              </h1>
              <div
                className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-stone-600"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                {project.river && <span>{project.river}</span>}
                {project.district && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {project.district}
                  </span>
                )}
                {project.capacity_kw && <span>{project.capacity_kw} kW target</span>}
                <StatusBadge status={project.status} />
              </div>
            </div>

            <div className="text-right">
              <div
                className="text-[11px] tracking-[0.2em] uppercase text-stone-500"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Progress
              </div>
              <div className="text-3xl text-stone-900" style={{ fontFamily: 'var(--font-display), Georgia, serif' }}>
                {completedCount}<span className="text-stone-400">/{items.length}</span>
              </div>
              <div className="mt-1 w-32 h-1 bg-stone-200 rounded">
                <div className="h-1 bg-emerald-700 rounded" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Module grid ────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-10">
        <h2
          className="text-[11px] tracking-[0.2em] uppercase text-stone-500 mb-4"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          Design modules
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((m) => {
            const isComplete = completed.has(m.id)
            const Icon = m.icon
            const cardInner = (
              <div
                className={
                  'group relative h-full bg-white border rounded p-5 transition-colors ' +
                  (m.ready
                    ? 'border-stone-200 hover:border-emerald-700 hover:shadow-sm cursor-pointer'
                    : 'border-stone-200 opacity-60')
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        'w-10 h-10 rounded flex items-center justify-center ' +
                        (m.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-400')
                      }
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div
                        className="text-[10px] tracking-[0.2em] uppercase text-stone-400"
                        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                      >
                        Module {m.num}
                      </div>
                      <div
                        className="text-lg text-stone-900"
                        style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
                      >
                        {m.label}
                      </div>
                    </div>
                  </div>
                  {m.ready ? (
                    isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-700 shrink-0" />
                    )
                  ) : (
                    <Lock className="w-4 h-4 text-stone-300 shrink-0" />
                  )}
                </div>
                <p className="mt-3 text-sm text-stone-600 leading-relaxed">{m.desc}</p>
                <div
                  className="mt-3 text-[10px] tracking-[0.2em] uppercase text-emerald-800/70"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  {m.cite}
                  {isComplete && <span className="ml-2 text-stone-400">· saved</span>}
                </div>
              </div>
            )
            return m.ready && m.href ? (
              <Link key={m.id} href={m.href} className="block h-full">
                {cardInner}
              </Link>
            ) : (
              <div key={m.id} className="h-full">
                {cardInner}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status?: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:       { label: 'Draft',       cls: 'bg-stone-100 text-stone-700' },
    in_progress: { label: 'In progress', cls: 'bg-amber-50 text-amber-800' },
    complete:    { label: 'Complete',    cls: 'bg-emerald-50 text-emerald-800' },
  }
  const s = map[status ?? 'draft'] ?? map.draft
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] tracking-wider uppercase ${s.cls}`}>
      {s.label}
    </span>
  )
}