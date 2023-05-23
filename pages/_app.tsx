import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider, Session } from '@supabase/auth-helpers-react'
import { useState } from 'react'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import { projects } from '@prisma/client'

import 'styles/global.css'

import Header from 'components/Header'
import { Database } from 'db/supabase'
import { clientCreds } from 'db/credentials'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

function App({ Component, pageProps }: AppProps<{ initialSession: Session, project?: projects }>) {
  const router = useRouter()
  const [supabaseClient] = useState(() => createBrowserSupabaseClient<Database>(clientCreds))

  const hasHeader = !router.pathname.startsWith('/sign') && !router.pathname.startsWith('/agent')

  return (
    <main className={clsx(
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
        {hasHeader &&
          <Header project={pageProps.project} />
        }
        <Component {...pageProps} />
      </SessionContextProvider>
    </main>
  )
}

export default App
