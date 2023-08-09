import React, {ReactNode} from 'react'
import { Metadata } from 'next'
import { PostHogProvider } from './_lib/posthog'
import SupabaseProvider from './_lib/supabase'
import {createServerComponentSupabaseClient} from '@supabase/auth-helpers-nextjs'
import {cookies, headers} from 'next/headers'

import 'styles/global.css'

export default async function RootLayout({ children }: { children: ReactNode }) {
  // TODO: Replace with createServerComponentClient after updating @supabase/auth-helpers-nextjs to newest version
  const supabaseClient = createServerComponentSupabaseClient({ headers, cookies})
  const {data: { session }} = await supabaseClient.auth.getSession()
  return (
    <html lang="en">
      <body>
        {/* Beware that "old" Layout.tsx is handling user tracking for GA, but _app.tsx for Posthog */}
        <PostHogProvider>
          <SupabaseProvider initialSession={session}>
            {children}
          </SupabaseProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  robots: 'follow, index',
  title: 'e2b', // will be rewritten in sub routes
  description: 'e2b', // will be rewritten in sub routes
  openGraph: {
    description: 'e2b', // will be rewritten in sub routes
    siteName: 'e2b', // will be rewritten in sub routes
    type: 'website',
    // TODO: More
  }
}
