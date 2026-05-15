export default function ProjectsLoading() {
  return (
    <div className="p-8 max-w-6xl animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-stone-200 rounded" />
          <div className="h-8 w-48 bg-stone-200 rounded" />
        </div>
        <div className="h-10 w-32 bg-stone-300 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-stone-200 bg-white p-6 space-y-3">
            <div className="h-3 w-20 bg-stone-200 rounded" />
            <div className="h-6 w-3/4 bg-stone-200 rounded" />
            <div className="h-3 w-full bg-stone-100 rounded" />
            <div className="h-3 w-5/6 bg-stone-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}