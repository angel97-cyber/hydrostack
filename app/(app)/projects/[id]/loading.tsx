export default function ProjectLoading() {
  return (
    <div className="p-8 max-w-5xl animate-pulse">
      <div className="space-y-3 mb-10">
        <div className="h-3 w-32 bg-stone-200 rounded" />
        <div className="h-9 w-2/3 bg-stone-200 rounded" />
        <div className="h-4 w-1/2 bg-stone-200 rounded" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="border border-stone-200 bg-white p-5 flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-stone-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 bg-stone-200 rounded" />
              <div className="h-5 w-1/2 bg-stone-200 rounded" />
            </div>
            <div className="h-5 w-16 bg-stone-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}