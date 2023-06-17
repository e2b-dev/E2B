import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { nanoid } from 'nanoid'

import { deployments, prisma, projects } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import DashboardHome from 'components/DashboardHome'
import { RawFileLog, Log } from 'utils/agentLogs'

export type ProjectWithLogFiles = projects & {
  deployments: deployments[]
  logs: Log[]
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  // Select the 'deployed' view by default.
  const view = ctx.query['view'] as string
  const joinTeamID = ctx.query['team'] as string | undefined
  if (!view) {
    return {
      redirect: {
        destination: joinTeamID ? `/?view=logs&team=${joinTeamID}` : '/?view=logs',
        permanent: false,
      }
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
    (joinTeamID && await prisma.teams.update({
      where: {
        id: joinTeamID,
      },
      data: {
        users_teams: {
          connectOrCreate: {
            where: {
              user_id_team_id: {
                team_id: joinTeamID,
                user_id: session.user.id,
              },
            },
            create: {
              user_id: session.user.id,
            },
          },
        },
      },
      include: {
        projects: {
          include: {
            logs: true,
          },
        },
      },
    })) ||
    await prisma.teams.create({
      include: {
        projects: {
          include: {
            logs: true,
          }
        }
      },
      data: {
        id: nanoid(),
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
    defaultTeam.projects.find(p => p.is_default) ||
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
        .map<ProjectWithLogFiles>(p => {
          return {
            ...p,
            // Don't send any deployments to the client.
            deployments: [],
            logs: p
              .logs
              .filter(l => l.data !== null)
              .map(l => {
                return {
                  id: l.id,
                  files: (l.data as unknown as RawFileLog[]).map(f => ({
                    name: f.filename,
                    relativePath: f.metadata.relativePath,
                  }))
                }
              })
          }
        })
    },
  }
}

export interface Props {
  projects: ProjectWithLogFiles[]
  defaultProjectID: string
}

function Home({ projects, defaultProjectID }: Props) {
  return (
    <DashboardHome
      defaultProjectID={defaultProjectID}
      projects={projects}
    />
  )
}

export default Home
