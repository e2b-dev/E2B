import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { nanoid } from 'nanoid'

import { prisma, projects, log_files, log_uploads, deployments } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import DashboardHome from 'components/DashboardHome'

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  // Select the 'deployed' view by default.
  const view = ctx.query['view'] as string
  const defaultNewTeamID = process.env.DEFAULT_NEW_TEAM_ID as string | undefined
  if (!view) {
    return {
      redirect: {
        destination: '/?view=logs',
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
                  log_uploads: {
                    include: {
                      log_files: true,
                    },
                  },
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
    (defaultNewTeamID && await prisma.teams.update({
      where: {
        id: defaultNewTeamID,
      },
      data: {
        users_teams: {
          connectOrCreate: {
            where: {
              user_id_team_id: {
                team_id: defaultNewTeamID,
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
            log_uploads: {
              include: {
                log_files: true,
              },
            },
          },
        },
      },
    })) ||
    await prisma.teams.create({
      include: {
        projects: {
          include: {
            log_uploads: {
              include: {
                log_files: true,
              },
            },
          },
        },
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
        log_uploads: {
          include: {
            log_files: true,
          },
        },
      },
    })

  return {
    props: {
      defaultProjectID: defaultProject.id,
      projects: [defaultProject]
        .map(p => ({
          ...p,
          // Don't send any deployments to the client but keep the props structure so we don't have to change the component now.
          deployments: [],
          log_uploads: p
            .log_uploads
            .map<LiteLogUpload>(u => ({
              ...u,
              log_files: u.log_files.map(f => ({
                ...f,
                content: undefined,
              })),
            }))
        }))
    },
  }
}

export interface LiteLogUpload extends Omit<log_uploads, 'log_files'> {
  log_files: Omit<log_files, 'content'>[]
}

export interface Props {
  projects: (projects & { log_uploads: LiteLogUpload[], deployments: deployments[] })[]
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
