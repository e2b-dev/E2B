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

import DashboardDesktopSidebar from 'components/Sidebar/DashboardDesktopSidebar'
import DashboardMobileSidebar from 'components/Sidebar/DashboardMobileSidebar'
import FeedbackButton from 'components/FeedbackButton'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const navigation = [
  // {
  //   name: 'Deployed Agents',
  //   view: 'deployed',
  //   icon: Zap,
  // },
  // {
  //   name: 'Agent Runs',
  //   view: 'runs',
  //   icon: ListEnd,
  // },
  {
    name: 'Agent Logs',
    view: 'logs',
    icon: List,
  },
]

function Layout({ children }: PropsWithChildren) {
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const posthog = usePostHog()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const view = router.query.view as string | undefined

  async function signOut() {
    await supabaseClient.auth.signOut()
    posthog?.reset(true)
    router.push('/sign')
  }

  useEffect(function identifyUser() {
    if (user) {
      posthog?.identify(user.id, {
        email: user.email,
      })
    }
  }, [posthog, user])


  if (router.pathname.startsWith('/agent')) {
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
        {children}
      </div>
    )
  }

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
      <div className="overflow-hidden">
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
      </div>

      <div className="xl:pl-56 flex flex-col flex-1 max-h-full">
        {/* Mobile menu icon */}
        <div className="xl:hidden sticky top-0 z-40 flex justify-between h-16 shrink-0 items-center gap-x-6 border-b border-white/5 bg-gray-900 px-4 shadow-sm sm:px-6 lg:px-8">
          <button type="button" className="-m-2.5 p-2.5 text-white xl:hidden" onClick={() => setIsSidebarOpen(true)}>
            <span className="sr-only">Open sidebar</span>
            <Menu aria-hidden="true" />
          </button>

          <div className="xl:hidden">
            <FeedbackButton
              onClick={() => { console.log('todo') }}
            />
          </div>
        </div>

        <div className="hidden xl:flex py-2 px-6 border-b border-white/5">
          <FeedbackButton
            onClick={() => { console.log('todo') }}
          />
        </div>

        {children}
      </div>
    </div>
  )
}

export default Layout
