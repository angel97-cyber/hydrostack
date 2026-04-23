import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Waves, FlaskConical, Zap, BarChart3, DollarSign, FileText, Droplets, CheckCircle2, Lock, MapPin } from 'lucide-react'

const modules = [
  { id: 'hydrology', label: 'Hydrology', icon: Waves, desc: 'Q40, Q80, Qmean, high flood, gross/net head', week: 2 },
  { id: 'intake', label: 'Intake & Settling Basin', icon: FlaskConical, desc: 'AEPC grain size, basin dimensions', week: 2 },
  { id: 'headrace', label: 'Headrace & Forebay', icon: Droplets, desc: "Manning's n, head losses, forebay sizing", week: 3 },
  { id: 'penstock', label: 'Penstock & Anchor Blocks', icon: Zap, desc: 'IS 5330 bearing, sliding, overturning checks', week: 3 },
  { id: 'powerhouse', label: 'Powerhouse & Turbine', icon: Zap, desc: 'Pelton/Crossflow/Turgo/Francis selection', week: 3 },
  { id: 'energy', label: 'Energy Table', icon: BarChart3, desc: 'Monthly GWh · English + Nepali months', week: 4 },
  { id: 'financial', label: 'Financial Model', icon: DollarSign, desc: 'CapEx, IRR, NPV, LCoE · NPR/USD', week: 4 },
  { id: 'export', label: 'Export DFS + DXF', icon: FileText, desc: 'AEPC 2014 format PDF + 5 DXF typicals', week: 4 },
]

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).single()
  if (!project) notFound()

  const { data: completedModules } = await supabase.from('project_modules').select('module').eq('project_id', project.id)
  const completed = new Set(completedModules?.map((m) => m.module) || [])
  const progress = Math.round((completed.size / modules.length) * 100)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-white/35 hover:text-white/60 text-sm transition-colors mb-6">
        <ArrowLeft className="w-3.5 h-3.5" />Projects
      </Link>

      <div className="mb-8">
        <h1 className="text-white font-semibold text-2xl tracking-tight">{project.name}</h1>
        <div className="flex items-center gap-4 mt-2 text-white/35 text-sm">
          {project.river && <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5" />{project.river}</span>}
          {project.district && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{project.district}</span>}
          {project.capacity_kw && <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" />{project.capacity_kw} kW</span>}
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-500/10">
            {project.standard === 'AEPC_NP' ? 'AEPC Nepal' : project.standard}
          </span>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/35 text-xs">{completed.size}/{modules.length} modules complete</span>
            <span className="text-white/35 text-xs">{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {modules.map((mod) => {
          const isComplete = completed.has(mod.id)
          const Icon = mod.icon
          return (
            <div key={mod.id} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isComplete ? 'bg-emerald-500/15' : 'bg-white/[0.04]'}`}>
                  <Icon className={`w-4 h-4 ${isComplete ? 'text-emerald-400' : 'text-white/25'}`} />
                </div>
                {isComplete
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : <div className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-white/20" /><span className="text-[10px] text-white/20">Week {mod.week}</span></div>}
              </div>
              <h3 className="text-white/70 font-medium text-sm mb-1">{mod.label}</h3>
              <p className="text-white/25 text-xs leading-relaxed">{mod.desc}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-8 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-2xl p-6 text-center">
        <Waves className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-white/80 font-semibold mb-1">Hydrology module coming Week 2</h3>
        <p className="text-white/35 text-sm max-w-sm mx-auto">Q40/Q80, gross/net head, salt-dilution flow inputs. The AEPC 2014 methodology, coded precisely.</p>
      </div>
    </div>
  )
}