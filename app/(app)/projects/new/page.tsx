'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, Zap, Droplets, MapPin } from 'lucide-react'
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

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', river: '', district: '', capacity_kw: '', standard: 'AEPC_NP' })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    let orgId = profile?.org_id

    if (!orgId) {
  const { data: newOrgId, error: wsErr } = await supabase.rpc('create_user_workspace', {
    workspace_name: user.email?.split('@')[0] + "'s workspace"
  })
  if (wsErr) { setError(wsErr.message); setLoading(false); return }
  orgId = newOrgId
}

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        org_id: orgId,
        name: form.name,
        river: form.river || null,
        district: form.district || null,
        capacity_kw: form.capacity_kw ? parseFloat(form.capacity_kw) : null,
        standard: form.standard,
        status: 'draft',
        created_by: user.id,
      })
      .select().single()

    if (projErr) { setError(projErr.message); setLoading(false); return }
    router.push(`/projects/${project.id}`)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to projects
        </Link>
        <h1 className="text-white font-semibold text-2xl tracking-tight">New Project</h1>
        <p className="text-white/40 text-sm mt-1">Set up your hydropower site details to begin the DFS workflow.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-white/60 text-sm font-medium mb-2">Project Name <span className="text-emerald-500">*</span></label>
          <input
            type="text"
            placeholder="e.g. Shyam Khola HPP — DFS 2026"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            required
            className="w-full bg-white/[0.04] border border-white/10 text-white placeholder-white/20 rounded-xl py-3 px-4 text-sm outline-none focus:border-emerald-500/50 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 text-sm font-medium mb-2"><Droplets className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />River Name</label>
            <input type="text" placeholder="e.g. Shyam Khola" value={form.river} onChange={e => update('river', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 text-white placeholder-white/20 rounded-xl py-3 px-4 text-sm outline-none focus:border-emerald-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-white/60 text-sm font-medium mb-2"><MapPin className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />District</label>
            <select value={form.district} onChange={e => update('district', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl py-3 px-4 text-sm outline-none focus:border-emerald-500/50 transition-all appearance-none">
              <option value="" className="bg-[#0d1210]">Select district</option>
              {NEPAL_DISTRICTS.map(d => <option key={d} value={d} className="bg-[#0d1210]">{d}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 text-sm font-medium mb-2"><Zap className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />Installed Capacity (kW)</label>
            <input type="number" placeholder="e.g. 7200" value={form.capacity_kw} onChange={e => update('capacity_kw', e.target.value)} min="0" step="0.1"
              className="w-full bg-white/[0.04] border border-white/10 text-white placeholder-white/20 rounded-xl py-3 px-4 text-sm outline-none focus:border-emerald-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-white/60 text-sm font-medium mb-2">Design Standard</label>
            <select value={form.standard} onChange={e => update('standard', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl py-3 px-4 text-sm outline-none focus:border-emerald-500/50 transition-all appearance-none">
              <option value="AEPC_NP" className="bg-[#0d1210]">AEPC Nepal (2014)</option>
              <option value="MNRE_IN" className="bg-[#0d1210]">MNRE India</option>
              <option value="GENERIC" className="bg-[#0d1210]">Generic</option>
            </select>
          </div>
        </div>

        <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-4">
          <p className="text-emerald-400/80 text-xs leading-relaxed">
            <strong className="text-emerald-400">AEPC Nepal (2014)</strong> applies AEPC Micro Hydro Standard 2014 guidelines — settling basin grain sizes, IS 5330 anchor block checks, and the AEPC DFS chapter format.
          </p>
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Link href="/projects" className="flex-1 text-center py-3 rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm font-medium transition-all">Cancel</Link>
          <button type="submit" disabled={loading || !form.name}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-semibold transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}