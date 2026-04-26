import type { Metadata } from 'next'
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: 'variable',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HydroStack — AEPC-compliant DFS in under an hour',
  description:
    'The design workbench for mini and micro hydropower in Nepal. Hydrology, intake, penstock, anchor blocks, energy table, and financial model — every AEPC typical, generated in one flow.',
  keywords: ['AEPC', 'hydropower', 'micro-hydro', 'mini-hydro', 'DFS', 'Nepal', 'IS 5330'],
  authors: [{ name: 'Angel Mainali' }],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body
        className="bg-stone-50 text-stone-900"
        style={{ fontFamily: 'var(--font-body), system-ui, -apple-system, sans-serif' }}
      >
        {children}
      </body>
    </html>
  )
}