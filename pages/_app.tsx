import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider, Session } from '@supabase/auth-helpers-react'
import { useState } from 'react'
import clsx from 'clsx'
import { projects } from '@prisma/client'

import 'styles/global.css'

import { Database } from 'db/supabase'
import { clientCreds } from 'db/credentials'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

function App({ Component, pageProps }: AppProps<{ initialSession: Session, project?: projects }>) {
  const [supabaseClient] = useState(() => createBrowserSupabaseClient<Database>(clientCreds))

  return (
    <div className={clsx(
      inter.variable,
      'font-sans',
      'flex',
      'h-full',
      'w-full',
      'flex-1',
      'flex-col',
      'overflow-hidden',
    )}>
      <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={pageProps.initialSession}
      >
        <Component {...pageProps} />
      </SessionContextProvider>
    </div>
  )
}

export default App
