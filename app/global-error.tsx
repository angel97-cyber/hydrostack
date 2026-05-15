'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#fafaf9', margin: 0, padding: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '420px', width: '100%', background: 'white', borderLeft: '4px solid #b45309', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.15em', color: '#78716c', textTransform: 'uppercase', margin: '0 0 12px' }}>
              Critical Error
            </p>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', color: '#1c1917', margin: '0 0 16px', fontWeight: 'normal' }}>
              Application crashed
            </h1>
            <p style={{ color: '#57534e', lineHeight: 1.6, margin: '0 0 24px', fontSize: '14px' }}>
              The application encountered a critical error and could not recover. Please try reloading the page.
            </p>
            {error.digest && (
              <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a8a29e', margin: '0 0 24px' }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{ padding: '10px 18px', background: '#1c1917', color: '#fafaf9', fontSize: '14px', border: 'none', cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}