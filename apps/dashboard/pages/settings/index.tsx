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

  let apiKey = await prisma.team_api_keys.findFirst({
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

  if (!apiKey) {
    const user = await prisma.auth_users.findUnique({
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
    if (!user) {
      return res.status(401).json({
        error: 'invalid_user',
      })
    }
    const defaultTeam = user.users_teams.find((t) => t.teams.is_default)
    if (!defaultTeam) {
      return {
        redirect: {
          destination: '/',
          permanent: false,
        },
      }
    }

    while (true) {
      const generatedApiKey = generateApiKey()
      try {
        apiKey = await prisma.team_api_keys.create({
          data: {
            team_id: defaultTeam.teams.id,
            api_key: generatedApiKey,
          },
        })
        break
      } catch (e) {
        // Duplicate key error
        if (e.code !== 'P2002') {
          throw e
        }
      }
    }

    posthog?.capture({
      distinctId: user.id,
      event: 'created API key',
      team: defaultTeam.teams.team_id,
    })
  }

  return {
    props: {
      apiKey: apiKey.api_key,
    },
  }
}

interface Props {
  apiKey: string;
}

function SettingsPage({ apiKey }: Props) {
  return <Settings apiKey={apiKey} />
}

export default SettingsPage
