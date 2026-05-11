// app/(app)/projects/[id]/report/download-button.tsx
// Client-side download trigger. Calls GET /projects/[id]/report and either
// streams the DOCX as a blob download, or surfaces a 400/500 JSON error.

'use client'

import { useState } from 'react'

interface Props {
  projectId: string
  projectName: string
  disabled?: boolean
}

export function DownloadButton({ projectId, projectName, disabled }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/projects/${projectId}/report/generate`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!res.ok) {
        // Server returns JSON for error cases (auth/not-found/financial-missing/build-fail)
        let msg = `Report generation failed (${res.status})`
        try {
          const body = await res.json()
          if (body?.error) msg = body.error
        } catch {
          /* not JSON */
        }
        setError(msg)
        setBusy(false)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      // Honour server-suggested filename if present, else build one.
      const cd = res.headers.get('content-disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/i)
      const safeName = projectName.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) || 'project'
      const filename =
        match?.[1] ?? `DFS_${safeName}_${new Date().getFullYear()}.docx`

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={disabled || busy}
        className={[
          'inline-flex items-center gap-2 rounded-md px-5 py-2.5 font-mono text-sm font-medium transition',
          disabled
            ? 'cursor-not-allowed bg-stone-200 text-stone-400'
            : busy
              ? 'cursor-wait bg-stone-700 text-white'
              : 'bg-stone-900 text-white hover:bg-stone-700',
        ].join(' ')}
      >
        {busy ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"
              />
            </svg>
            Building report…
          </>
        ) : (
          <>↓ Generate &amp; download DFS report (.docx)</>
        )}
      </button>

      {disabled && (
        <p className="mt-2 text-xs text-stone-500">
          Save the Financial Model module first to enable download.
        </p>
      )}
      {error && (
        <div className="mt-3 rounded-md border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}
    </div>
  )
}