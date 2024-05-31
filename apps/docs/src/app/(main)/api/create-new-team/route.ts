export const dynamic = 'force-dynamic' // static by default, unless reading the request
export const runtime = 'nodejs'

import { Team } from '@/utils/useUser'
import { createClient } from '@supabase/supabase-js'
import { uniqueNamesGenerator, Config, adjectives, colors } from 'unique-names-generator'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const customConfig: Config = {
  dictionaries: [adjectives, colors],
  separator: '-',
  length: 2,
}

// TODO this needs some auth
export async function POST(request: Request) {

  const { email, user_id } = await request.json()

  const newTeam = {
    name: uniqueNamesGenerator(customConfig),
    is_default: false,
    is_blocked: false,
    email: email,
    is_banned: false,
    blocked_reason: null,
    tier: 'base_v1',
  }

  const { data: team, error } = await supabase
    .from('teams')
    .insert(newTeam)
    .select()
  
  if (error) {
    // TODO: Add sentry event here
    console.log(error)
    return new Response('Failed creating new team', { status: 503 })
  }


  let insertedTeam: Team
  try {
    insertedTeam = team[0] as Team
  }
  catch (e) {
    console.log(e)
    return new Response('Failed creating new team', { status: 503 })
  }

  const data = await supabase
    .from('users_teams')
    .insert({ user_id: user_id, team_id: insertedTeam.id })

  if (data.error) {
    // TODO: Add sentry event here
    console.log(data.error)
    return new Response('Failed creating new team', { status: 503 })
  }

  return new Response(JSON.stringify({ team: insertedTeam }), { status: 200 })
}

