import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/projects',
          '/projects/*',
          '/settings',
          '/settings/*',
          '/admin',
          '/admin/*',
          '/api/',
          '/subscribe/',
          '/auth/',
        ],
      },
    ],
    sitemap: 'https://usehydrostack.com/sitemap.xml',
  }
}