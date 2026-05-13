'use client'

export function ContactButtons({
  waUrl,
  viberUrl,
}: {
  waUrl: string
  viberUrl: string
}) {
  const primary =
    'flex items-center justify-center rounded-sm bg-emerald-800 px-6 py-4 font-mono text-sm text-white transition hover:bg-emerald-900'
  const secondary =
    'flex items-center justify-center rounded-sm border border-stone-400 bg-white px-6 py-4 font-mono text-sm text-stone-900 transition hover:bg-stone-50'

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <a href={waUrl} target="_blank" rel="noopener noreferrer" className={primary}>
        WhatsApp Angel
      </a>
      <a href={viberUrl} target="_blank" rel="noopener noreferrer" className={secondary}>
        Viber Angel
      </a>
    </div>
  )
}