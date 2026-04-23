import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Zap, Droplets, MapPin, Calendar, ChevronRight, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const standardLabels: Record<string, { label: string; color: string }> = {
  AEPC_NP: { label: 'AEPC Nepal', color: 'text-emerald-400 bg-emerald-500/10' },
  MNRE_IN: { label: 'MNRE India', color: 'text-blue-400 bg-blue-500/10' },
  GENERIC: { label: 'Generic', color: 'text-white/40 bg-white/[0.06]' },
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-amber-400 bg-amber-500/10' },
  in_progress: { label: 'In Progress', color: 'text-blue-400 bg-blue-500/10' },
  complete: { label: 'Complete', color: 'text-emerald-400 bg-emerald-500/10' },
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user!.id)
    .single()

  const { data: projects } = profile?.org_id
    ? await supabase
        .from('projects')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-semibold text-2xl tracking-tight">Projects</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {projects?.length === 0
              ? 'No projects yet — create your first DFS project below.'
              : `${projects?.length} project${projects?.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {(!projects || projects.length === 0) && (
        <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Droplets className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-white/80 font-semibold text-lg mb-2">No projects yet</h2>
          <p className="text-white/35 text-sm max-w-xs mx-auto mb-6 leading-relaxed">
            Create your first HydroStack project and generate an AEPC-compliant DFS in under an hour.
          </p>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" />
            Create first project
          </Link>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => {
            const std = standardLabels[project.standard] || standardLabels.GENERIC
            const status = statusLabels[project.status] || statusLabels.draft
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/15 rounded-2xl p-5 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${std.color}`}>{std.label}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                  </div>
                </div>
                <h3 className="text-white font-semibold text-base mb-1 group-hover:text-emerald-300 transition-colors">
                  {project.name}
                </h3>
                <div className="flex items-center gap-4 text-white/35 text-xs mb-4">
                  {project.river && <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{project.river}</span>}
                  {project.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{project.district}</span>}
                  {project.capacity_kw && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{project.capacity_kw} kW</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-white/25 text-xs">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                  </span>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: 'Total Projects', value: projects.length, icon: FileText },
            { label: 'In Progress', value: projects.filter((p) => p.status === 'in_progress').length, icon: Zap },
            { label: 'Complete', value: projects.filter((p) => p.status === 'complete').length, icon: Droplets },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <Icon className="w-4 h-4 text-white/30 mb-2" />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/30 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}