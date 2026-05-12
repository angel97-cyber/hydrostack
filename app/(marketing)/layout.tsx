import { ReactNode } from 'react'
import MarketingNav from './_components/marketing-nav'
import MarketingFooter from './_components/marketing-footer'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 antialiased">
      <MarketingNav />
      <div className="flex-1">{children}</div>
      <MarketingFooter />
    </div>
  )
}