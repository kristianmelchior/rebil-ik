import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

// Load Inter via next/font — injects as CSS variable --font-inter
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Rebil Dashboard',
  description: 'Innkjøpskonsulent ytelsesdashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nb" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
