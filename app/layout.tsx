import React, { ReactNode } from 'react'
import { Metadata } from 'next'
import { PostHogProvider } from './_lib/PostHogProvider'
import { SupabaseProvider } from './_lib/SupabaseProvider'
import { createServerComponentSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { cookies, headers } from 'next/headers'

import 'styles/global.css'

// Reasoning: https://github.com/vercel/next.js/pull/52916
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabaseClient = createServerComponentSupabaseClient({ headers, cookies })
  const {
    data: { session },
  } = await supabaseClient.auth.getSession()
  return (
    <html lang="en">
      <body>
        <SupabaseProvider initialSession={session}>
          <PostHogProvider>{children}</PostHogProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  robots: 'follow, index',
  // override in sub routes as needed
  title: 'Smol Developer | e2b', 
  description: 'Smol Developer | e2b',
  openGraph: {
    description: 'Smol Developer | e2b',
    siteName: 'Smol Developer | e2b',
    type: 'website',
  },
}
