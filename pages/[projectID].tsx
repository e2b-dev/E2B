import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { ParsedUrlQuery } from 'querystring'

import { prisma, projects, deployments } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import AgentDetail from 'components/AgentDetail'

interface PathProps extends ParsedUrlQuery {
  projectID: string
}

export const getServerSideProps: GetServerSideProps<Props, PathProps> = async (ctx) => {
  const projectID = ctx.params?.projectID
  if (!projectID) {
    return {
      notFound: true,
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
    select: {
      users_teams: {
        select: {
          teams: {
            include: {
              projects: {
                include: {
                  deployments: true,
                },
                where: {
                  id: {
                    equals: projectID,
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  const project = user
    ?.users_teams
    .flatMap(t => t.teams.projects)
    .find(p => p.id === projectID)

  if (!project) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      project,
    }
  }
}

interface Props {
  project: projects & { deployments: deployments[] }
}

function ProjectPage({ project }: Props) {
  return (
    <AgentDetail
      project={project}
    />
  )
}

export default ProjectPage
