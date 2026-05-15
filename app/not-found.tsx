import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-6">
      <div className="max-w-md w-full">
        <div className="border-l-4 border-stone-900 bg-white p-8 shadow-sm">
          <p className="text-xs font-mono tracking-widest text-stone-500 uppercase mb-3">
            Not Found · 404
          </p>
          <h1 className="font-serif text-3xl text-stone-900 mb-4">
            Page not found
          </h1>
          <p className="text-stone-600 mb-6 leading-relaxed text-sm">
            The page you&rsquo;re looking for doesn&rsquo;t exist. It may have been
            moved, renamed, or never existed at all.
          </p>
          <div className="flex gap-3">
            <Link
              href="/projects"
              className="px-4 py-2 bg-stone-900 text-stone-50 text-sm hover:bg-stone-800 transition-colors"
            >
              Go to projects
            </Link>
            <Link
              href="/"
              className="px-4 py-2 border border-stone-300 text-stone-700 text-sm hover:bg-stone-100 transition-colors"
            >
              Home
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