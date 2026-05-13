'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

const NEPAL_DISTRICTS = [
  'Achham','Arghakhanchi','Baglung','Baitadi','Bajhang','Bajura','Banke','Bara','Bardiya',
  'Bhaktapur','Bhojpur','Chitwan','Dadeldhura','Dailekh','Dang','Darchula','Dhading',
  'Dhankuta','Dhanusa','Dolakha','Dolpa','Doti','Eastern Rukum','Gorkha','Gulmi',
  'Humla','Ilam','Jajarkot','Jhapa','Jumla','Kailali','Kalikot','Kanchanpur','Kapilvastu',
  'Kaski','Kathmandu','Kavrepalanchok','Khotang','Lalitpur','Lamjung','Mahottari',
  'Makwanpur','Manang','Morang','Mugu','Mustang','Myagdi','Nawalparasi East',
  'Nawalparasi West','Nuwakot','Okhaldhunga','Palpa','Panchthar','Parbat','Parsa',
  'Pyuthan','Ramechhap','Rasuwa','Rautahat','Rolpa','Rupandehi','Salyan','Sankhuwasabha',
  'Saptari','Sarlahi','Sindhuli','Sindhupalchok','Siraha','Solukhumbu','Sunsari',
  'Surkhet','Syangja','Tanahu','Taplejung','Tehrathum','Udayapur','Western Rukum',
]

function FieldLabel({ children, unit }: { children: React.ReactNode; unit?: string }) {
  return (
    <label className="flex items-baseline justify-between mb-1.5">
      <span
        className="text-[10px] tracking-[0.18em] uppercase text-stone-600 font-medium"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        {children}
      </span>
      {unit && (
        <span
          className="text-[10px] text-stone-400 tracking-wide"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          [{unit}]
        </span>
      )}
    </label>
  )
}

const inputCls =
  'w-full bg-white border border-stone-300 text-stone-900 placeholder:text-stone-400 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition-all rounded-none'

export function NewProjectForm() {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [form,    setForm]    = useState({
    name: '', river: '', district: '', capacity_kw: '', standard: 'AEPC_NP',
  })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Client-side project limit check (belt-and-suspenders is in page.tsx server gate)
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, plan, project_limit')
      .eq('id', user.id)
      .single()

    // Enforce limit for non-beta users
    if (profile && profile.plan !== 'beta') {
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
      if ((count ?? 0) >= (profile.project_limit ?? 999)) {
        setError('Project limit reached. Upgrade at /settings/billing.')
        setLoading(false)
        return
      }
    }

    let orgId = profile?.org_id

    if (!orgId) {
      const { data: newOrgId, error: wsErr } = await supabase.rpc(
        'create_user_workspace',
        { workspace_name: (user.email?.split('@')[0] ?? 'My') + "'s workspace" },
      )
      if (wsErr) { setError(wsErr.message); setLoading(false); return }
      orgId = newOrgId
    }

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        org_id:      orgId,
        name:        form.name,
        river:       form.river || null,
        district:    form.district || null,
        capacity_kw: form.capacity_kw ? parseFloat(form.capacity_kw) : null,
        standard:    form.standard,
        status:      'draft',
        created_by:  user.id,
      })
      .select()
      .single()

    if (projErr) { setError(projErr.message); setLoading(false); return }
    router.push(`/projects/${project.id}`)
  }

  return (
    <div className="min-h-full bg-stone-50" style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}>
      <div className="border-b border-stone-200 bg-white px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-800 text-sm transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to projects
          </Link>
          <p
            className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-1 font-medium"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            §1 — Project Setup
          </p>
          <h1
            className="text-3xl text-stone-900"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            New Project
          </h1>
          <p className="text-stone-500 text-sm mt-1.5">
            Site details used across all calculation modules.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8">
        <form onSubmit={handleSubmit}>

          <div className="bg-white border border-stone-200 p-6 mb-4">
            <FieldLabel>Project Name *</FieldLabel>
            <input
              type="text"
              placeholder="e.g. Shyam Khola HPP — DFS 2026"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              required
              className={inputCls}
            />
            <p className="mt-2 text-[10px] text-stone-400" style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
              This appears on the DFS title block and all exported drawings.
            </p>
          </div>

          <div className="bg-white border border-stone-200 p-6 mb-4">
            <p className="text-[10px] tracking-[0.18em] uppercase text-stone-500 font-medium mb-4" style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
              Site Location
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>River / Khola</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g. Shyam Khola"
                  value={form.river}
                  onChange={e => update('river', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>District</FieldLabel>
                <select value={form.district} onChange={e => update('district', e.target.value)} className={inputCls}>
                  <option value="">Select district</option>
                  {NEPAL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-6 mb-4">
            <p className="text-[10px] tracking-[0.18em] uppercase text-stone-500 font-medium mb-4" style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
              Technical Parameters
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel unit="kW">Installed Capacity</FieldLabel>
                <input
                  type="number"
                  placeholder="7200"
                  value={form.capacity_kw}
                  onChange={e => update('capacity_kw', e.target.value)}
                  min="0"
                  step="0.1"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Design Standard</FieldLabel>
                <select value={form.standard} onChange={e => update('standard', e.target.value)} className={inputCls}>
                  <option value="AEPC_NP">AEPC Nepal 2014</option>
                  <option value="MNRE_IN">MNRE India (AHEC-IITR)</option>
                  <option value="GENERIC">Generic</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 px-5 py-4 mb-6 text-[13px] text-emerald-900 leading-relaxed">
            <span className="font-medium" style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
              AEPC Nepal 2014:
            </span>{' '}
            Applies AEPC Reference Micro-Hydro Power Standard 2014 — settling basin grain
            sizes (0.2 mm for H &gt; 100 m, 0.3 mm for H &lt; 100 m), IS 5330 anchor block
            stability checks, IS 11625 penstock hydraulic design, and the AEPC DFS chapter
            format. Correct for all Nepal projects requiring AEPC / DoED approval.
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 px-5 py-4 mb-6 text-sm text-red-800" style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
              Error: {error}
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/projects"
              className="flex-1 text-center py-3 border border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-400 text-sm font-medium transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !form.name}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 text-sm font-medium tracking-wide transition-colors"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Project →'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}