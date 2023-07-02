import {
  PropsWithChildren,
  useEffect,
  useState,
} from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import clsx from 'clsx'
import { useRouter } from 'next/router'
import { Inter } from 'next/font/google'
import { usePostHog } from 'posthog-js/react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import {
  Menu,
  List,
} from 'lucide-react'
import Script from 'next/script'

import DashboardDesktopSidebar from 'components/Sidebar/DashboardDesktopSidebar'
import DashboardMobileSidebar from 'components/Sidebar/DashboardMobileSidebar'
import Feedback from 'components/Feedback'

import * as gtag from '../utils/gtag'
import StarUs from './StarUs'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

function Layout({ children }: PropsWithChildren) {
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const posthog = usePostHog()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [distinctID, setDistinctID] = useState<string>()

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      gtag.pageview(url, distinctID)
    }
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.events, distinctID])

  async function signOut() {
    await supabaseClient.auth.signOut()
    posthog?.reset(true)
    router.push('/sign')
  }

  useEffect(function handleDistinctID() {
    setDistinctID(posthog?.get_distinct_id())
  }, [posthog])

  useEffect(function identifyUser() {
    if (user) {
      posthog?.identify(user.id, {
        email: user.email,
      })
    }
  }, [posthog, user])

  const view = process.env.NEXT_PUBLIC_SHOW_UPLOADED_LOGS === '1'
  const showView = router.query['view'] === 'logs' ? 'logs' : view

  const navigation = [
    {
      name: showView === 'logs' ? 'Agent Logs' : 'Agent Deployments',
      icon: List,
    },
  ]

  return (
    <>
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
      {(router.pathname.startsWith('/agent') || router.pathname.startsWith('/sign'))
        ?
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
          {children}
        </div>
        :
        <>
          <style jsx global>
            {`
        :root {
          --font-inter: ${inter.variable};
        }
        `}
          </style>
          <div className={clsx(
            'font-sans',
            'flex-1',
            'flex',
            'items-start',
            'justify-start',
            'p-2',
            'h-full',
            'w-full',
            'overflow-hidden',
          )}>
            <DashboardMobileSidebar
              isSidebarOpen={isSidebarOpen}
              onSetSidebarOpen={setIsSidebarOpen}
              onSignOut={signOut}
              navigation={navigation}
            />
            <DashboardDesktopSidebar
              onSignOut={signOut}
              navigation={navigation}
            />

            <div className="flex flex-col flex-1 self-stretch overflow-hidden">
              {/* Mobile menu icon */}
              <div className="rounded-md xl:hidden sticky top-0 z-40 flex justify-between h-16 shrink-0 items-center gap-x-6 border border-white/5 bg-gray-900 px-4 shadow-sm sm:px-6 lg:px-8">
                <button
                  type="button"
                  className="-m-2.5 p-2.5 text-white xl:hidden"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <span className="sr-only">Open sidebar</span>
                  <Menu aria-hidden="true" />
                </button>

                <div className="xl:hidden flex space-x-4">
                  <StarUs />
                  <Feedback />
                </div>
              </div>

              {/* Header` */}
              <div className="hidden xl:flex px-4 py-2 border border-white/5 justify-end bg-gray-900 rounded-md">
                <div className="flex justify-end space-x-4">
                  <StarUs />
                  <Feedback />
                </div>
              </div>

              <div className="mt-1 flex-1 flex flex-col self-stretch overflow-auto bg-gray-900 rounded-md border border-white/5">
                {children}
              </div>
            </div>
          </div>
        </>
      }
    </>
  )
}

export default Layout
