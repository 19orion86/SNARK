import type { Metadata } from 'next'
import { AuthProvider } from '@/hooks/use-auth'
import { RegisterServiceWorker } from '@/components/pwa/register-sw'
// Шрифты лежат в node_modules (@fontsource): сборка не ходит в Google Fonts.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/cyrillic-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/cyrillic-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/cyrillic-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/cyrillic-700.css'
import '@fontsource/exo-2/latin-400.css'
import '@fontsource/exo-2/cyrillic-400.css'
import '@fontsource/exo-2/latin-500.css'
import '@fontsource/exo-2/cyrillic-500.css'
import '@fontsource/exo-2/latin-600.css'
import '@fontsource/exo-2/cyrillic-600.css'
import '@fontsource/exo-2/latin-700.css'
import '@fontsource/exo-2/cyrillic-700.css'
import '@fontsource/exo-2/latin-800.css'
import '@fontsource/exo-2/cyrillic-800.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'СНАРК — Корпоративный портал',
  description: 'Корпоративный портал интегратора инфраструктуры городского электротранспорта',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  manifest: '/manifest.webmanifest',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="bg-background">
      <body className="font-sans antialiased">
        <AuthProvider>
          <RegisterServiceWorker />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
