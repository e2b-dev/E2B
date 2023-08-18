import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import Settings from 'components/Settings'
import { client as posthog } from 'utils/posthog'
import { generateApiKey } from 'utils/apiKey'

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
  let apiKeyValue: string | undefined

  const apiKey = await prisma.team_api_keys.findFirst({
    include: {
      teams: {
        include: {
          users_teams: {
            where: {
              user_id: {
                equals: session.user.id,
              },
            },
          },
        },
      },
    },
  })

  apiKeyValue = apiKey?.api_key

  if (!apiKey) {
    const user = await prisma.auth_users.findUniqueOrThrow({
      where: {
        id: session.user.id,
      },
      include: {
        users_teams: {
          include: {
            teams: true,
          },
        },
      },
    })
    const defaultTeam = user.users_teams.find((t) => t.teams.is_default)
    if (!defaultTeam) {
      return {
        redirect: {
          destination: '/',
          permanent: false,
        },
      }
    }

    for (let i = 0; i < 100; i++) {
      apiKeyValue = generateApiKey()
      try {
        await prisma.team_api_keys.create({
          data: {
            team_id: defaultTeam.teams.id,
            api_key: apiKeyValue,
          },
        })
        break
      } catch (e: any) {
        // TODO: Get prisma typed error
        // Duplicate key error
        if (e.code !== 'P2002') {
          throw e
        }
      }
    }

    posthog?.capture({
      distinctId: user.id,
      event: 'created API key',
      team: defaultTeam.teams.id,
    })
  }

  return {
    props: {
      apiKey: apiKey?.api_key!,
    }
  }
}

interface Props {
  apiKey: string
}

function SettingsPage({ apiKey }: Props) {
  return <Settings apiKey={apiKey} />
}

export default SettingsPage
