export const dynamic = 'force-dynamic' // static by default, unless reading the request
export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: Request) {
  await supabase.auth.api.getUserByCookie(request)
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    console.log(error)
    return new Response(error.message, { status: 500 })
  }
  if (!session) {
    return new Response('Not logged in', { status: 401 })
  }


  const { userIds }  = await request.json() // Expecting an array of user IDs

  const userPromises = userIds.map((userId: string) =>
    supabase.auth.admin.getUserById(userId)
  )

  const usersResults = await Promise.all(userPromises)

  if (!usersResults.some(({data}) => data.user.id === session.user.id)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userInfos = usersResults.map(({ data, error }) => {
    if (error) {
      console.log(error)
      return { error: 'Failed getting user data', details: error.message }
    }
    const userInfo = {
      id: data.user.id,
      email: data.user.email,
    }
    return userInfo
  })

  return new Response(JSON.stringify(userInfos), { status: 200 })
}
