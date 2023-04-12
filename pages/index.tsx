import type { GetServerSideProps } from 'next'
import useSWRMutation from 'swr/mutation'
import { LayoutGrid, Plus } from 'lucide-react'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/router'

import ItemList from 'components/ItemList'
import Text from 'components/Text'
import { prisma, projects } from 'db/prisma'
import Button from 'components/Button'
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
              projects: true,
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
    // User is one of the old users without default team - create default team.
    const team = await prisma.teams.create({
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
      include: {
        projects: true,
      },
    })

    return {
      redirect: {
        permanent: false,
        destination: '/new',
      },
    }
  }

  // Show projects from all teams.
  const projects = user.users_teams.flatMap(t => t.teams.projects)

  if (projects.length === 0) {
    return {
      redirect: {
        permanent: false,
        destination: '/new',
      },
    }
  }

  return {
    props: {
      projects,
    }
  }
}

interface DeleteProjectBody {
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
  projects: projects[]
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
    <div
      className="
      flex
      flex-1
      flex-col
      space-x-0
      space-y-4
      overflow-hidden
      p-8
      lg:flex-row
      lg:space-y-0
      lg:space-x-4
      lg:p-12
    "
    >
      <div className="flex items-start space-x-4 lg:justify-start justify-between">
        <div className="items-center flex space-x-2">
          <LayoutGrid size="30px" strokeWidth="1.5" />
          <Text
            size={Text.size.S1}
            text="Projects"
          />
        </div>

        <Button
          icon={<Plus size="16px" />}
          text="New"
          variant={Button.variant.Full}
          onClick={() => router.push('/new')}
        />
      </div>

      <div
        className="
        flex
        flex-1
        flex-col
        items-stretch
        overflow-hidden
        "
      >
        <div className="flex flex-1 justify-center overflow-hidden">
          <ItemList
            deleteItem={handleDelete}
            items={projects.map(i => ({
              ...i,
              title: i.name,
              path: '/[projectID]',
              type: 'Project',
              icon: <LayoutGrid size="22px" strokeWidth="1.7" />,
            }))}
          />
        </div>
      </div>
    </div>
  )
}

export default Home