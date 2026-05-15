export default function ModuleLoading() {
  return (
    <div className="p-8 max-w-5xl animate-pulse">
      <div className="space-y-2 mb-8">
        <div className="h-3 w-24 bg-stone-200 rounded" />
        <div className="h-8 w-2/3 bg-stone-200 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-32 bg-stone-200 rounded" />
              <div className="h-10 w-full bg-stone-100 rounded" />
            </div>
          ))}
        </div>
        <div className="border border-stone-200 bg-stone-50 p-6 space-y-3">
          <div className="h-3 w-24 bg-stone-200 rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-1/3 bg-stone-200 rounded" />
              <div className="h-3 w-1/4 bg-stone-300 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}