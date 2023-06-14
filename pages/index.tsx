import { useState, Fragment } from 'react'
import type { GetServerSideProps, Redirect } from 'next'
import Link from 'next/link'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { Dialog, Transition } from '@headlessui/react'
import clsx from 'clsx'
import {
  Zap,
  ListEnd,
  X,
  Menu,
} from 'lucide-react'
import { useRouter } from 'next/router'
import { usePostHog } from 'posthog-js/react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

import { deployments, prisma, projects } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import AgentList from 'components/AgentList'
import AgentRunsList from 'components/AgentRunsList'

const navigation = [
  {
    name: 'Deployed Agents',
    view: 'deployed',
    icon: Zap,
  },
  {
    name: 'Agent Runs',
    view: 'runs',
    icon: ListEnd,
  },
]

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const supabase = createServerSupabaseClient(ctx, serverCreds)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return {
      redirect: {
        destination: '/sign',
        permanent: false,
      },
    }
  }

  const user = await prisma.auth_users.findUnique({
    where: {
      id: session.user.id,
    },
    include: {
      users_teams: {
        include: {
          teams: {
            include: {
              projects: {
                orderBy: {
                  created_at: 'desc',
                },
                include: {
                  deployments: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user) {
    return {
      redirect: {
        destination: '/sign',
        permanent: false,
      }
    }
  }

  const hasDefaultTeam = user?.users_teams.some(t => t.teams.is_default)
  if (!hasDefaultTeam) {
    // If user is without default team create default team.
    await prisma.teams.create({
      data: {
        name: session.user.email || session.user.id,
        is_default: true,
        users_teams: {
          create: {
            users: {
              connect: {
                id: session.user.id,
              }
            }
          }
        },
      },
    })

    return {
      redirect: {
        permanent: false,
        destination: '/agent/smol-developer',
      },
    }
  }

  // Show projects from all teams.
  const projects = user.users_teams.flatMap(t => t.teams.projects)

  // Select the 'deployed' view by default.
  const view = ctx.query['view'] as string
  let redirect: Redirect | undefined
  if (!view) {
    redirect = {
      destination: '/?view=deployed',
      permanent: false,
    }
  }

  return {
    props: {
      projects,
    },
    redirect,
  }
}

interface Props {
  projects: (projects & { deployments: deployments[] })[]
}

function Home({ projects }: Props) {
  const supabaseClient = useSupabaseClient()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const posthog = usePostHog()

  const view = router.query.view as string | undefined
  const selectedAgentInstanceID = router.query.projectID as string | undefined

  async function signOut() {
    await supabaseClient.auth.signOut()
    posthog?.reset(true)
    router.push('/sign')
  }

  function selectAgent(e: any, projectID: string) {
    e.preventDefault()
    posthog?.capture('selected deployed agent', { projectID: projectID })
    router.push(`/?view=runs&projectID=${projectID}`, undefined, { shallow: true })
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
      {/* Mobile sidebar */}
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
                      <X className="text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                {/* Sidebar component, swap this element with another sidebar if you like */}
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 ring-1 ring-white/10">
                  {/* Logo */}
                  {/* <div className="flex h-16 shrink-0 items-center">
                    <img
                      className="h-8 w-auto"
                      src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=500"
                      alt="Your Company"
                    />
                  </div> */}
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={`/?view=${item.view}`}
                                className={clsx(
                                  item.view === view
                                    ? 'bg-gray-800 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800',
                                  'group gap-x-3 rounded-md px-2 py-1 text-sm leading-6 font-semibold flex items-center'
                                )}
                                shallow
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className="hidden xl:fixed xl:inset-y-0 xl:z-50 xl:flex xl:w-72 xl:flex-col">
        {/* Sidebar component, swap this element with another sidebar if you like */}
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-black/10 px-6 ring-1 ring-white/5">
          {/* Logo */}
          {/* <div className="flex h-16 shrink-0 items-center">
            <img
              className="h-8 w-auto"
              src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=500"
              alt="Your Company"
            />
          </div> */}
          <nav className="flex flex-1 flex-col py-[22px]">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={`/?view=${item.view}`}
                        className={clsx(
                          item.view === view
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800',
                          'group gap-x-3 rounded-md px-2 py-1 text-sm leading-6 font-semibold flex items-center'
                        )}
                        shallow
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

      <div className="xl:pl-72 flex flex-col max-h-full">
        {/* Mobile menu icon */}
        <div className="xl:hidden sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-6 border-b border-white/5 bg-gray-900 px-4 shadow-sm sm:px-6 lg:px-8">
          <button type="button" className="-m-2.5 p-2.5 text-white xl:hidden" onClick={() => setSidebarOpen(true)}>
            <span className="sr-only">Open sidebar</span>
            <Menu aria-hidden="true" />
          </button>
        </div>

        {view === 'deployed' ? (
          <AgentList
            agents={projectsWithDeployments}
            onSelectAgent={selectAgent}
          />
        ) : view === 'runs' ? (
          <AgentRunsList
            allDeployedAgents={projectsWithDeployments}
            initialSelectedAgentID={selectedAgentInstanceID}
          />
        ) : (
          <span>404</span>
        )}
      </div>
    </div >
  )
}

export default Home
