'use client'

import { ReactNode, useState } from 'react'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { Database } from 'db/supabase'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { clientCreds } from '../../db/credentials'

// Based on https://github.com/supabase/auth-helpers/pull/397
export function SupabaseProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession: any;
}) {
  const [supabaseClient] = useState(() =>
    createBrowserSupabaseClient<Database>(clientCreds)
  )

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={initialSession}
    >
      {children}
    </SessionContextProvider>
  )
}
