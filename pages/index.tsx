import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

import { prisma, api_deployments } from 'db/prisma'
import { notEmpty } from 'utils/notEmpty'
import DeploymentEditor from 'components/Editor'
import { StoreProvider } from 'state/StoreProvider'

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const supabase = createServerSupabaseClient(ctx)
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

  const user = await prisma.auth_users.findUniqueOrThrow({
    where: {
      id: session.user.id,
    },
    select: {
      users_teams: {
        where: {
          teams: {
            is_default: {
              equals: true,
            },
          },
        },
        select: {
          teams: {
            select: {
              id: true,
              api_deployments: true,
            },
          }
        }
      }
    },
  })

  const hasDefaultTeam = user?.users_teams.some(t => t.teams)
  if (!hasDefaultTeam) {
    // User is one of the old users without default team - create default team.
    const team = await prisma.teams.create({
      data: {
        name: session.user.email || session.user.id,
        is_default: true,
        api_deployments: {
          create: {
            data: {},
          },
        },
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
      include: {
        api_deployments: true
      },
    })

    if (!team.api_deployments) {
      return {
        notFound: true
      }
    }

    return {
      props: {
        deployment: team.api_deployments,
      }
    }
  }


  const apiDeploymentsFromDefaultTeam = user
    .users_teams
    .flatMap(t => t.teams.api_deployments)
    .filter(notEmpty)

  if (apiDeploymentsFromDefaultTeam.length > 0) {
    return {
      props: {
        deployment: apiDeploymentsFromDefaultTeam[0],
      }
    }
  }

  const defaultDeployment = await prisma.api_deployments.create({
    data: {
      data: {},
      team_id: user.users_teams[0].teams.id,
    },
  })

  return {
    props: {
      deployment: defaultDeployment,
    }
  }
}

interface Props {
  deployment: api_deployments
}

function ProjectPage({ deployment }: Props) {
  const client = useSupabaseClient()

  return (
    <StoreProvider
      client={client}
      deployment={deployment}
    >
      <DeploymentEditor />
    </StoreProvider>
  )
}

export default ProjectPage
