import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { Grid } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'

import { projects, deployments } from 'db/prisma'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'

const navigation = [
  {
    name: 'Deployed Agents',
    href: '#',
    icon: Grid,
    current: true,
  },
  {
    name: 'Run Queue',
    href: '#',
    icon: Grid,
    current: false,
  },
]

const statuses = {
  disabled: 'text-gray-500 bg-gray-100/10',
  enabled: 'text-green-400 bg-green-400/10',
}

export interface Props {
  projects: (projects & { deployments: deployments[] })[]
}

export default function AgentOverview({ projects }: Props) {
  const supabaseClient = useSupabaseClient()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const posthog = usePostHog()

  async function signOut() {
    await supabaseClient.auth.signOut()
    posthog?.reset(true)
    router.push('/sign')
  }

  function selectAgent(projectID: string) {
    posthog?.capture('selected deployed agent', { projectID: projectID })
    router.push(`/${projectID}`)
  }

  const projectsWithDeployments = projects
    .filter(p => {
      if (p.deployments.length !== 1) return false

      const deployment = p.deployments[0]
      const auth = deployment.auth as any
      if (!auth) return false
      return deployment.enabled
    })
    .map(p => ({
      project: p,
      deployment: p.deployments[0],
    }))

  return (
    <div className="overflow-hidden">
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 xl:hidden" onClose={setSidebarOpen}>
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
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                      <span className="sr-only">Close sidebar</span>
                      {/* <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" /> */}
                    </button>
                  </div>
                </Transition.Child>
                {/* Sidebar component, swap this element with another sidebar if you like */}
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 ring-1 ring-white/10">
                  <div className="flex h-16 shrink-0 items-center">
                    {/* <img
                      className="h-8 w-auto"
                      src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=500"
                      alt="Your Company"
                    /> */}
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <a
                                href={item.href}
                                className={clsx(
                                  item.current
                                    ? 'bg-gray-800 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800',
                                  'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                )}
                              >
                                <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                {item.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </li>
                      <li className="-mx-6 mt-auto">
                        <a
                          href="#"
                          className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-white hover:bg-gray-800"
                        >
                          <span className="sr-only">Your profile</span>
                          <span aria-hidden="true">Tom Cook</span>
                        </a>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
      {/* Static sidebar for desktop */}
      <div className="hidden xl:fixed xl:inset-y-0 xl:z-50 xl:flex xl:w-72 xl:flex-col">
        {/* Sidebar component, swap this element with another sidebar if you like */}
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-black/10 px-6 ring-1 ring-white/5">
          <div className="flex h-16 shrink-0 items-center">
            {/* <img
              className="h-8 w-auto"
              src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=500"
              alt="Your Company"
            /> */}
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        className={clsx(
                          item.current
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                        )}
                      >
                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="-mx-6 mt-auto">
                <div
                  className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-white"
                >
                  <button
                    className="text-sm font-semibold text-white"
                    onClick={signOut}
                  >
                    Log out
                  </button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <div className="xl:pl-72">
        <main className="overflow-hidden">
          <header className="flex items-center justify-between border-b border-white/5 p-4 sm:p-6 lg:px-8">
            <h1 className="text-base font-semibold leading-7 text-white">Agents</h1>
          </header>

          {/* Deployment list */}
          <ul role="list" className="divide-y divide-white/5 overflow-auto">
            {projectsWithDeployments.map((p) => (
              <li key={p.project.id} className="relative flex items-center space-x-4 p-4 sm:px-6 lg:px-8">
                <div
                  className="min-w-0 flex-auto cursor-pointer"
                  onClick={() => selectAgent(p.project.id)}
                >
                  <div className="flex items-center gap-x-3">
                    <div className={clsx(statuses[p.deployment.enabled ? 'enabled' : 'disabled'], 'flex-none rounded-full p-1')}>
                      <div className="h-2 w-2 rounded-full bg-current" />
                    </div>
                    <h2 className="min-w-0 text-sm font-semibold leading-6 text-white">
                      <a className="flex gap-x-2">
                        <span className="truncate">{p.project.name}</span>
                        <span className="text-gray-400">-</span>
                        <span className="whitespace-nowrap">{(p.deployment?.auth as any)?.['github']?.['owner'] + '/' + (p.deployment?.auth as any)?.['github']?.['repo']}</span>
                        <span className="absolute inset-0" />
                      </a>
                    </h2>
                  </div>
                  <div className="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
                    <p className="truncate">{`PR#${(p.deployment?.auth as any)?.['github']?.['pull_number']}`}</p>
                    <svg viewBox="0 0 2 2" className="h-0.5 w-0.5 flex-none fill-gray-300">
                      <circle cx={1} cy={1} r={1} />
                    </svg>
                  </div>
                </div>
                <ChevronRightIcon
                  className="h-5 w-5 flex-none text-gray-400" aria-hidden="true"
                />
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div >
  )
}
