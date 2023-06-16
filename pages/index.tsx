import type { GetServerSideProps, Redirect } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'

import { deployments, prisma, projects } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import DashboardHome from 'components/DashboardHome'
import { LogFile, RawFileLog } from 'utils/agentLogs'
import { nanoid } from 'nanoid'

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  // Select the 'deployed' view by default.
  const view = ctx.query['view'] as string
  let redirect: Redirect | undefined
  if (!view) {
    redirect = {
      // destination: '/?view=deployed',
      destination: '/?view=logs',
      permanent: false,
    }
  }

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
                  logs: true,
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

  const defaultTeam =
    user?.users_teams.flatMap(u => u.teams)?.find(t => t.is_default) ||
    await prisma.teams.create({
      include: {
        projects: {
          include: {
            logs: true,
          }
        }
      },
      data: {
        name: session.user.email || session.user.id,
        is_default: true,
        projects: {
          create: {
            name: 'Default Project',
            is_default: true,
          },
        },
        users_teams: {
          create: {
            users: {
              connect: {
                id: session.user.id,
              },
            },
          },
        },
      },
    })

  const defaultProject =
    user.users_teams.flatMap(u => u.teams.projects).find(p => p.is_default) ||
    await prisma.projects.create({
      data: {
        id: nanoid(),
        is_default: true,
        name: 'Default Project',
        teams: {
          connect: {
            id: defaultTeam.id,
          },
        },
      },
      include: {
        logs: true,
      },
    })

  return {
    props: {
      defaultProjectID: defaultProject.id,
      projects: [defaultProject]
        .map<projects & { logs: LogFile[], deployments: deployments[] }>(p => {
          return {
            ...p,
            // Don't send any deployments to the client.
            deployments: [],
            logs: p
              .logs
              .filter(l => l.data !== null && l.data.length > 0)
              .map<LogFile>(l => {
                const log = l.data[0] as unknown as RawFileLog
                return {
                  id: l.id,
                  name: log.filename,
                }
              })
          }
        })
    },
    redirect,
  }
}

export interface Props {
  projects: (projects & { logs: LogFile[], deployments: deployments[] })[]
  defaultProjectID: string
}

function Home({ projects, defaultProjectID }: Props) {
  console.log(defaultProjectID)
  return (
    <DashboardHome
      defaultProjectID={defaultProjectID}
      projects={projects}
    />
  )
}

export default Home
