import type { GetServerSideProps, Redirect } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'



import { deployments, prisma, projects } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import DashboardHome from 'components/DashboardHome'

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

export interface Props {
  projects: (projects & { deployments: deployments[] })[]
}

function Home({ projects }: Props) {
  return (
    <DashboardHome
      projects={projects}
    />
  )
}

export default Home
