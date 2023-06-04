import type { GetServerSideProps } from 'next'
import useSWRMutation from 'swr/mutation'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/router'

import AgentOverview from 'components/AgentOverview'
import { deployments, prisma, projects } from 'db/prisma'
import { serverCreds } from 'db/credentials'

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
  if (projects.length === 0) {
    return {
      redirect: {
        permanent: false,
        destination: '/agent/smol-developer',
      },
    }
  }

  return {
    props: {
      projects,
    }
  }
}

export interface DeleteProjectBody {
  id: string
}

async function handleDeleteProject(url: string, { arg }: { arg: DeleteProjectBody }) {
  return await fetch(url, {
    method: 'DELETE',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

interface Props {
  projects: (projects & { deployments: deployments[] })[]
}

function Home({ projects }: Props) {
  const router = useRouter()

  const {
    trigger: deleteProject,
  } = useSWRMutation('/api/project', handleDeleteProject)

  async function handleDelete(id: string) {
    await deleteProject({ id })
    router.replace(router.asPath)
  }

  return (
    <AgentOverview
      projects={projects}
    />
  )
}

export default Home