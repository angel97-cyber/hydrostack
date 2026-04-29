import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Zap, Droplets, MapPin, ChevronRight, FileText } from 'lucide-react'

const standardLabels: Record<string, { label: string }> = {
  AEPC_NP: { label: 'AEPC Nepal 2014' },
  MNRE_IN: { label: 'MNRE India' },
  GENERIC: { label: 'Generic' },
}

const statusColors: Record<string, string> = {
  draft:       'text-amber-700 bg-amber-50 border-amber-200',
  in_progress: 'text-blue-700 bg-blue-50 border-blue-200',
  complete:    'text-emerald-700 bg-emerald-50 border-emerald-200',
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
    <div
      className="min-h-full bg-stone-50"
      style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}
    >
      {/* Page header */}
      <div className="border-b border-stone-200 bg-white px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-end justify-between">
          <div>
            <p
              className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-1 font-medium"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Workspace
            </p>
            <h1
              className="text-3xl text-stone-900 leading-none"
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontWeight: 500,
                letterSpacing: '-0.02em',
              }}
            >
              Projects
            </h1>
            <p
              className="text-stone-500 text-sm mt-1.5"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              {projects?.length === 0
                ? 'No projects — create your first DFS project'
                : `${projects?.length} project${projects?.length === 1 ? '' : 's'} found`}
            </p>
          </div>
          <Link
            href="/projects/new"
            className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2.5 text-sm font-medium tracking-wide transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Empty state */}
        {(!projects || projects.length === 0) && (
          <div className="border border-dashed border-stone-300 bg-white p-16 text-center">
            <div
              className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-5 font-medium"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              No projects yet
            </div>
            <h2
              className="text-2xl text-stone-800 mb-3"
              style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
            >
              Start your first DFS project
            </h2>
            <p className="text-stone-500 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
              Create a project, enter your survey data, and generate an AEPC-compliant DFS in under an hour.
            </p>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 bg-emerald-800 hover:bg-emerald-900 text-white px-5 py-2.5 text-sm font-medium tracking-wide transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create first project
            </Link>
          </div>
        )}

        {/* Projects table-like list */}
        {projects && projects.length > 0 && (
          <>
            {/* Table header */}
            <div
              className="grid grid-cols-12 gap-4 px-4 py-2 mb-1 text-[10px] tracking-[0.15em] uppercase text-stone-500 font-medium"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <div className="col-span-5">Project name</div>
              <div className="col-span-3">Location / River</div>
              <div className="col-span-2">Capacity</div>
              <div className="col-span-2">Status</div>
            </div>

            {/* Project rows */}
            <div className="bg-white border border-stone-200 divide-y divide-stone-100">
              {projects.map((project) => {
                const std = standardLabels[project.standard] || standardLabels.GENERIC
                const statusCls = statusColors[project.status] || statusColors.draft
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-stone-50 transition-colors group"
                  >
                    <div className="col-span-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-800/10 border border-emerald-800/20 flex items-center justify-center shrink-0">
                          <Droplets className="w-3.5 h-3.5 text-emerald-700" />
                        </div>
                        <div>
                          <p className="text-stone-900 font-medium text-sm group-hover:text-emerald-800 transition-colors">
                            {project.name}
                          </p>
                          <p
                            className="text-stone-400 text-[10px] mt-0.5"
                            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                          >
                            {std.label}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-3">
                      <div className="space-y-0.5">
                        {project.river && (
                          <p className="text-stone-600 text-xs flex items-center gap-1">
                            <Droplets className="w-3 h-3 text-stone-400" />
                            {project.river}
                          </p>
                        )}
                        {project.district && (
                          <p className="text-stone-600 text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            {project.district}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2">
                      {project.capacity_kw ? (
                        <p
                          className="text-stone-700 text-sm flex items-center gap-1"
                          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                        >
                          <Zap className="w-3 h-3 text-stone-400" />
                          {project.capacity_kw.toLocaleString()} kW
                        </p>
                      ) : (
                        <span className="text-stone-400 text-xs">—</span>
                      )}
                    </div>

                    <div className="col-span-2 flex items-center justify-between">
                      <span
                        className={`text-[10px] font-medium px-2 py-1 border tracking-wide uppercase ${statusCls}`}
                        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                      >
                        {project.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-emerald-700 transition-colors" />
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Stats bar */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { label: 'Total Projects', value: projects.length, icon: FileText },
                { label: 'In Progress', value: projects.filter((p) => p.status === 'in_progress').length, icon: Zap },
                { label: 'Complete', value: projects.filter((p) => p.status === 'complete').length, icon: Droplets },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white border border-stone-200 px-5 py-4 flex items-center gap-4">
                  <div className="w-8 h-8 border border-stone-200 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-stone-400" />
                  </div>
                  <div>
                    <p
                      className="text-2xl text-stone-900 leading-none"
                      style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
                    >
                      {value}
                    </p>
                    <p
                      className="text-stone-400 text-[10px] mt-1 tracking-wide"
                      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                    >
                      {label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}