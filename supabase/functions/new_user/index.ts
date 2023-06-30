import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  /**
   * Creates a new contact in Loops.so on a new created user in users table.
   */
  const data = await req.json()

  const body = {
    email: data.record.email,
    userGroup: 'Authenticated'
  }
  console.log(`New user with email: ${body.email} created`)

  const res = await fetch(
    'https://app.loops.so/api/v1/contacts/create',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${Deno.env.get('API_KEY_LOOPS')}` },
      body: JSON.stringify(body)
    }
  )
  if (res.ok) {
    console.log('Success')
    return new Response(await res.json())
  } else {
    console.log('Failed')
    return new Response(await res.text(), {
      status: 400,
    })
  }
})
