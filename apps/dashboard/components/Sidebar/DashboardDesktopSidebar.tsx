import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { usePostHog } from 'posthog-js/react'

import { Navigation } from './types'

export interface Props {
  onSignOut: () => void
  navigation: Navigation
}

function DashboardDesktopSidebar({
  onSignOut,
  navigation,
}: Props) {
  const router = useRouter()
  const posthog = usePostHog()

  return (
    <div className="hidden xl:self-stretch xl:z-50 xl:flex xl:w-[220px] xl:flex-col pr-1">
      <div className="flex grow flex-col gap-y-4 overflow-y-auto bg-gray-900 px-4 border border-white/5 rounded-md">
        {/* Logo */}
        <nav className="flex flex-1 flex-col space-y-8 py-4">
          <div className="font-bold text-gray-100">
            e2b
          </div>
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={'/'}
                      className={clsx(
                        router.pathname === '/'
                          ? 'bg-[#1F2437] text-white'
                          : 'text-gray-400 hover:text-white hover:bg-[#1F2437]',
                        'group gap-x-3 rounded-md transition-all px-2 py-1 text-sm leading-6 font-semibold flex items-center'
                      )}
                      onClick={() => {
                        posthog?.capture('clicked navigation item', {
                          item: item.name,
                        })
                      }}
                    >
                      <item.icon size={16} className="shrink-0" aria-hidden="true" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            <li className="-mx-6 mt-auto">
              <div
                className="flex items-center gap-x-4 px-6 text-sm font-semibold leading-6 text-white"
              >
                <button
                  className="text-sm font-semibold text-gray-400 hover:text-white transition-all"
                  onClick={onSignOut}
                >
                  Sign out
                </button>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}

export default DashboardDesktopSidebar