import type { Metadata } from 'next'
import { Inter, Exo_2 } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/hooks/use-auth'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
})

const exo2 = Exo_2({
  variable: '--font-exo-2',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'СНАРК — Корпоративный портал',
  description: 'Корпоративный портал интегратора инфраструктуры городского электротранспорта',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="bg-background">
      <body className={`${inter.variable} ${exo2.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
