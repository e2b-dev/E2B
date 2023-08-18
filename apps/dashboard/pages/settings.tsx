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


  if (apiKey) {
    apiKeyValue = apiKey.api_key
  } else {
    const user = await prisma.auth_users.findUniqueOrThrow({
      where: {
        id: session.user.id,
      },
      include: {
        users_teams: {
          include: {
            teams: true,
          },
          where: {
            teams: {
              is_default: {
                equals: true,
              },
            }
          },
        },
      }
    })

    let defaultTeam = user.users_teams[0].teams

    for (let i = 0; i < 5; i++) {
      apiKeyValue = generateApiKey()
      try {
        apiKey = await prisma.team_api_keys.create({
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
          data: {
            team_id: defaultTeam.id,
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
      groups: { team: defaultTeam.id },
    })
  }
  

  return {
    props: {
      apiKey: apiKey!.api_key,
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
