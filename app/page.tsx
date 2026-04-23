import WaitlistForm from '@/components/WaitlistForm'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm px-4 py-1 rounded-full mb-6">
          Built by a hydropower engineer, for hydropower engineers
        </div>
        <h1 className="text-5xl font-bold leading-tight mb-6">
          Generate your AEPC-compliant DFS{' '}
          <span className="text-blue-400">in under an hour</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
          HydroStack replaces the 13-year-old Chitrakar Excel+AutoCAD toolkit. 
          Hydrology, intake, penstock, anchor blocks, energy table, financial model — 
          one flow, one PDF, submission ready.
        </p>
        <WaitlistForm />
      </div>

      {/* What it replaces */}
      <div className="max-w-4xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-2xl font-bold text-center mb-12 text-slate-300">
          Everything in one workflow
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            'Hydrology (Q40/Q80)',
            'Intake & Settling Basin',
            'Headrace Canal/Pipe',
            'Penstock (IS codes)',
            'Anchor Blocks (IS 5330)',
            'Powerhouse Sizing',
            'Energy Table',
            'Financial Model (IRR/NPV)',
            'AEPC-format DFS PDF',
            'Editable DXF Drawings',
            'Nepali Month Output',
            'AI Copilot (coming soon)',
          ].map((feature) => (
            <div
              key={feature}
              className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-300"
            >
              ✓ {feature}
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="max-w-4xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-2xl font-bold text-center mb-4 text-slate-300">Pricing</h2>
        <p className="text-center text-slate-500 mb-12">
          Less than 1.5% of a single DFS consultancy fee.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="text-slate-400 text-sm mb-2">Solo</div>
            <div className="text-3xl font-bold mb-1">NPR 2,500<span className="text-lg font-normal text-slate-400">/mo</span></div>
            <div className="text-slate-500 text-sm mb-6">or NPR 25,000/year</div>
            <ul className="text-sm text-slate-400 space-y-2">
              <li>✓ 10 active projects</li>
              <li>✓ PDF + DXF export</li>
              <li>✓ 1 seat</li>
            </ul>
          </div>
          <div className="bg-blue-600 border border-blue-500 rounded-xl p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-400 text-blue-950 text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
            <div className="text-blue-100 text-sm mb-2">Studio</div>
            <div className="text-3xl font-bold mb-1">NPR 9,000<span className="text-lg font-normal text-blue-200">/mo</span></div>
            <div className="text-blue-300 text-sm mb-6">or NPR 90,000/year</div>
            <ul className="text-sm text-blue-100 space-y-2">
              <li>✓ Unlimited projects</li>
              <li>✓ PDF + DXF + Excel</li>
              <li>✓ 5 seats</li>
              <li>✓ Version history</li>
            </ul>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="text-slate-400 text-sm mb-2">Enterprise</div>
            <div className="text-3xl font-bold mb-1">NPR 25,000<span className="text-lg font-normal text-slate-400">/mo</span></div>
            <div className="text-slate-500 text-sm mb-6">or NPR 250,000/year</div>
            <ul className="text-sm text-slate-400 space-y-2">
              <li>✓ Unlimited projects</li>
              <li>✓ 20 seats + SSO</li>
              <li>✓ API access</li>
              <li>✓ White-label reports</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 py-8 text-center text-slate-600 text-sm">
        Built by Angel Mainali — Civil Engineer, Shyam Khola HPP 7.2 MW
      </div>
    </main>
  )
}