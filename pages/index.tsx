import type { GetServerSideProps } from 'next'
import { LayoutGrid, Plus } from 'lucide-react'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

import ItemList from 'components/ItemList'
import Text from 'components/Text'
import { prisma, projects } from 'db/prisma'
import Button from 'components/Button'
import { deploymentsTable, projectsTable } from 'db/tables'

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
      props: {
        projects: team.projects,
      }
    }
  }

  // Show projects from all teams.
  const projects = user.users_teams.flatMap(t => t.teams.projects)
  return {
    props: {
      projects,
    }
  }
}

interface Props {
  projects: projects[]
}

function Home({ projects }: Props) {
  const router = useRouter()

  const client = useSupabaseClient()

  async function handleDelete(id: string) {
    await client.from(deploymentsTable).delete().eq('project_id', id)
    await client.from(projectsTable).delete().eq('id', id)
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
          onClick={() => router.push('/new/project')}
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
              title: i.name || i.id,
              path: '/[id]',
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