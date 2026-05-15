'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-6">
      <div className="max-w-md w-full">
        <div className="border-l-4 border-amber-700 bg-white p-8 shadow-sm">
          <p className="text-xs font-mono tracking-widest text-stone-500 uppercase mb-3">
            Error · 500
          </p>
          <h1 className="font-serif text-3xl text-stone-900 mb-4">
            Something went wrong
          </h1>
          <p className="text-stone-600 mb-6 leading-relaxed text-sm">
            An unexpected error occurred. Any saved work is safe — only unsaved
            form changes may be lost. You can try again or head back to your projects.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-stone-400 mb-6">
              Error ID: <span className="text-stone-600">{error.digest}</span>
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
        <p className="text-xs font-mono text-stone-400 mt-6 text-center">
          HydroStack — DFS Platform for Nepal Hydropower
        </p>
      </div>
    </div>
  )
}