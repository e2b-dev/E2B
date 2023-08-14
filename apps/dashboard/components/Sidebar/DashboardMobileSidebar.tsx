import { Fragment } from 'react'
import Link from 'next/link'
import { Dialog, Transition } from '@headlessui/react'
import clsx from 'clsx'
import {
  X,
} from 'lucide-react'
import { useRouter } from 'next/router'

import { Navigation } from './types'

export interface Props {
  isSidebarOpen?: boolean
  onSetSidebarOpen: (isOpened: boolean) => void
  onSignOut: () => void
  navigation: Navigation
}

function DashboardMobileSidebar({
  isSidebarOpen,
  onSetSidebarOpen,
  onSignOut,
  navigation,
}: Props) {
  const router = useRouter()

  return (
    <Transition.Root show={isSidebarOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50 xl:hidden" onClose={onSetSidebarOpen}>
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/80" />
        </Transition.Child>

        <div className="fixed inset-0 flex">
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
              <Transition.Child
                as={Fragment}
                enter="ease-in-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in-out duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                  <button type="button" className="-m-2.5 p-2.5" onClick={() => onSetSidebarOpen(false)}>
                    <span className="sr-only">Close sidebar</span>
                    <X className="text-white" aria-hidden="true" />
                  </button>
                </div>
              </Transition.Child>
              {/* Sidebar component, swap this element with another sidebar if you like */}
              <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 ring-1 ring-white/10">
                {/* Logo */}
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" className="py-8 space-y-1">
                        {navigation.map((item) => (
                          <li key={item.name}>
                            <Link
                              href={'/'}
                              className={clsx(
                                router.pathname === '/'
                                  ? 'bg-gray-800 text-white'
                                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
                                'group gap-x-3 rounded-md px-2 py-1 text-sm leading-6 font-semibold flex items-center'
                              )}
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
                        className="flex items-center gap-x-4 p-8 text-sm font-semibold leading-6 text-white"
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
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

export default DashboardMobileSidebar