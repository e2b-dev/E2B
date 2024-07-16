import { headers } from 'next/headers'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s - E2B',
    default: 'E2B - Code Interpreting for AI apps',
  },
  description: 'Open-source secure sandboxes for AI code execution',
  twitter: {
    title: 'E2B - Code Interpreting for AI apps',
    description: 'Open-source secure sandboxes for AI code execution',
  },
  openGraph: {
    title: 'E2B - Code Interpreting for AI apps',
    description: 'Open-source secure sandboxes for AI code execution',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
 const heads = headers()

 const pathname = heads.get('next-url')

  return (
    <html lang="en">
      <body>
        <span>URL: {pathname}</span>
        {children}
      </body>
    </html>
  )
}
