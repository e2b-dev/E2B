import type { AppProps } from 'next/app'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider, Session } from '@supabase/auth-helpers-react'
import { useState } from 'react'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import { Toaster } from 'sonner'
import { projects } from '@prisma/client'

import 'styles/global.css'

import Header from 'components/Header'
import { Database } from 'db/supabase'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetBrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jet-brains',
})

function App({ Component, pageProps }: AppProps<{ initialSession: Session, project?: projects }>) {
  const router = useRouter()
  const [supabaseClient] = useState(() => createBrowserSupabaseClient<Database>())

  const isSignIn = router.pathname === '/sign' && router.query.signup !== 'true'
  const isSignUp = router.pathname === '/sign' && router.query.signup === 'true'

  return (
    <main className={clsx(
      inter.variable,
      jetBrains.variable,
      'font-sans',
      'flex',
      'h-inherit',
      'w-full',
      'flex-1',
      'flex-col',
      'overflow-hidden',
    )}>
      <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={pageProps.initialSession}
      >
        {!isSignIn && !isSignUp &&
          <Header project={pageProps.project} />
        }
        <Toaster />
        <Component {...pageProps} />
      </SessionContextProvider>
    </main>
  )
}

export default App
