'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Project page error:', error)
  }, [error])

  return (
    <div className="p-8 max-w-2xl">
      <div className="border-l-4 border-amber-700 bg-amber-50/30 p-6">
        <p className="text-xs font-mono tracking-widest text-amber-800 uppercase mb-2">
          Module Error
        </p>
        <h2 className="font-serif text-2xl text-stone-900 mb-3">
          Could not load this module
        </h2>
        <p className="text-stone-700 mb-4 leading-relaxed text-sm">
          Something went wrong loading this page. Your saved data is safe —
          only unsaved form changes may be lost.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-stone-500 mb-4">
            Error ID: <span className="text-stone-700">{error.digest}</span>
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-stone-900 text-stone-50 text-sm hover:bg-stone-800 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/projects"
            className="px-4 py-2 border border-stone-300 text-stone-700 text-sm hover:bg-stone-100 transition-colors"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  )
}