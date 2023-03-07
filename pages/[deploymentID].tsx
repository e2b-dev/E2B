import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { ParsedUrlQuery } from 'querystring'

import { prisma, api_deployments } from 'db/prisma'
import DeploymentEditor from 'components/Editor'
import { StoreProvider } from 'state/StoreProvider'

interface PathProps extends ParsedUrlQuery {
  deploymentID: string
}

export const getServerSideProps: GetServerSideProps<Props, PathProps> = async (ctx) => {
  const deploymentID = parseInt(ctx.params?.deploymentID || '')

  if (!deploymentID) {
    return {
      notFound: true,
    }
  }

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

  const user = await prisma.auth_users.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      users_teams: {
        select: {
          teams: {
            include: {
              api_deployments: {
                where: {
                  id: {
                    equals: deploymentID,
                  },
                }
              }
            },
          },
        },
      },
    },
  })

  const deployment = user?.users_teams.flatMap(t => t.teams.api_deployments).find(d => d.id === BigInt(deploymentID))
  if (!deployment) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      deployment,
    }
  }
}

interface Props {
  deployment: api_deployments
}

function EditorPage({ deployment }: Props) {
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

export default EditorPage
