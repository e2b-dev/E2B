import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { ParsedUrlQuery } from 'querystring'

import { prisma, projects } from 'db/prisma'
import Editor from 'components/Editor'
import { StoreProvider } from 'state/StoreProvider'
import { Database } from 'db/supabase'
import { inspect } from 'util'

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
              projects: {
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



  console.log(inspect(user, { depth: null }))
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
  project: projects
}

function EditorPage({ project }: Props) {
  const client = useSupabaseClient<Database>()

  return (
    <StoreProvider
      client={client}
      initialState={project}
    >
      <Editor project={project} />
    </StoreProvider>
  )
}

export default EditorPage
