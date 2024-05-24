export const dynamic = 'force-dynamic' // static by default, unless reading the request
export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const generateApiKey = (): string => {
  const keyPrefix = 'e2b_'
  const randomPart = randomBytes(20).toString('hex') // 20 bytes = 40 hex characters
  const apiKey = `${keyPrefix}${randomPart}`
  return apiKey
}

export async function POST(request: Request) {
  
  const { teamId } = await request.json()

  const newKey = {
    team_id: teamId,
    api_key: generateApiKey(),
    created_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('team_api_keys')
    .insert(newKey)


  if (error) {
    // TODO: Add sentry event here
    console.log(error)
    return new Response('Failed creating new api key', { status: 503 })
  } 


  return new Response(JSON.stringify({ api_key: newKey.api_key, createdAt: newKey.created_at }), { status: 200 })

}

