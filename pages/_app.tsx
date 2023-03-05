import type { AppProps } from 'next/app'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider, Session } from '@supabase/auth-helpers-react'

import 'styles/global.css'
import { useState } from 'react'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetBrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jet-brains',
})

export default function App(props: AppProps<{ initialSession: Session }>) {
  const [supabaseClient] = useState(() => createBrowserSupabaseClient())
  return (
    <main className={`${inter.variable} font-sans ${jetBrains.variable} flex h-inherit`}>
      <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={props.pageProps.initialSession}
      >
        <props.Component {...props.pageProps} />
      </SessionContextProvider>
    </main>
  )
}
