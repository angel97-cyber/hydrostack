'use client'

import { useActionState } from 'react'
import { createProject } from './actions'

const initial: { error?: string } = {}

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProject, initial)

  return (
    <form action={action} className="space-y-6">

      {state.error && (
        <div className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 font-mono text-sm text-red-800">
          {state.error}
        </div>
      )}

      {/* Project name */}
      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">
          Project name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          autoFocus
          placeholder="e.g. Shyam Khola HPP"
          className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 placeholder-stone-400 focus:border-stone-600 focus:outline-none"
        />
      </div>

      {/* River + District */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">
            River
          </label>
          <input
            type="text"
            name="river"
            placeholder="e.g. Shyam Khola"
            className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 placeholder-stone-400 focus:border-stone-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">
            District
          </label>
          <input
            type="text"
            name="district"
            placeholder="e.g. Sindhupalchowk"
            className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 placeholder-stone-400 focus:border-stone-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Capacity */}
      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">
          Design capacity (kW)
        </label>
        <input
          type="number"
          name="capacity_kw"
          min="1"
          step="0.1"
          placeholder="e.g. 500"
          className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 placeholder-stone-400 focus:border-stone-600 focus:outline-none"
        />
        <p className="mt-1 font-mono text-[10px] text-stone-400">
          Can be updated after completing the Powerhouse module.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-stone-900 px-8 py-3 font-mono text-sm text-white hover:bg-stone-800 disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create project'}
      </button>

    </form>
  )
}