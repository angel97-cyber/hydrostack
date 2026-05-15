import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PostHogProvider } from '@/lib/analytics/posthog-provider'

export const metadata: Metadata = {
  metadataBase: new URL('https://usehydrostack.com'),
  title: {
    default: 'HydroStack — DFS Platform for Nepal Hydropower',
    template: '%s · HydroStack',
  },
  description:
    'Submission-ready Detailed Feasibility Studies for AEPC and DoED. Built for senior Nepali hydropower engineers. Replaces legacy Excel and AutoCAD workflows for mini and micro hydropower projects.',
  keywords: [
    'AEPC DFS',
    'DoED submission',
    'Nepal hydropower',
    'micro hydropower',
    'mini hydropower',
    'run of river',
    'feasibility study Nepal',
    'penstock design',
    'anchor block design',
    'IS 5330',
    'IS 11625',
    'IS 11639',
    'hydropower engineering software',
    'AHEC IITR',
  ],
  authors: [{ name: 'Angel Mainali' }],
  creator: 'Angel Mainali',
  publisher: 'HydroStack',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://usehydrostack.com',
    siteName: 'HydroStack',
    title: 'HydroStack — DFS Platform for Nepal Hydropower',
    description:
      'Submission-ready DFS reports for AEPC and DoED. Built for senior Nepali hydropower engineers.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HydroStack — DFS Platform for Nepal Hydropower',
    description: 'Submission-ready DFS reports. Replaces legacy Excel and AutoCAD.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://usehydrostack.com',
  },
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  themeColor: '#1c1917',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}