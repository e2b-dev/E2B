import { Inter, JetBrains_Mono } from 'next/font/google'

import './globals.css'

export const metadata = {
  title: 'AI API',
  description: '',
}

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetBrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jet-brains',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" >
      <body className={`${inter.variable} font-sans ${jetBrains.variable} flex h-inherit`}>
        {children}
      </body>
    </html>
  )
}
