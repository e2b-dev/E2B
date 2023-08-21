'use client'

import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { clientCreds } from 'db/credentials'
import { Database } from 'db/supabase'
import Script from 'next/script'
import { ReactNode } from 'react'
import 'styles/global.css'
import * as gtag from '../utils/gtag'
import { RootLayoutHead } from './components/root-layout-head'
import { useAnalyticsProvider } from './utils/use-analytics-provider'

interface Props {
  children: ReactNode
}

export default function RootLayout({
  children,
}: Props) {
  const supabaseClient = createPagesBrowserClient<Database>(clientCreds)
  const { distinctID } = useAnalyticsProvider()

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
    >
      <html lang="en">
        <RootLayoutHead />
        <body suppressHydrationWarning={true}>
          <Script id="google-analytics">
            {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '${gtag.GA_TRACKING_ID}', {
            page_path: window.location.pathname,
            ${distinctID ? `user_id: ${distinctID}` : ''}
          });
        `}
          </Script>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtag.GA_TRACKING_ID}`}
          />
          <>{children}</>
        </body>
      </html>
    </SessionContextProvider>
  )
}
