import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { WebClient } from 'https://deno.land/x/slack_web_api@6.7.2/mod.js'

const SLACK_API_TOKEN = Deno.env.get('SLACK_NEW_USER_FEEDBACK_APP_OAUTH_TOKEN')
if (!SLACK_API_TOKEN) {
  throw new Error('Missing SLACK_NEW_USER_FEEDBACK_APP_OAUTH_TOKEN environment variable')
}
const SLACK_CHANNEL = 'user-signups'

console.log('Will create slack client')

const slackClient = new WebClient(SLACK_API_TOKEN)

console.log('Slack client created')

function sendSlackMessage(email: string) {
  const message = `:fire: *New User Signed Up *\n*User*\n${email}\n`

  return slackClient.chat.postMessage({
    channel: SLACK_CHANNEL,
    text: message,
    link_names: true,
  })
}

function sendToLoops(body: any) {
  return fetch(
    'https://app.loops.so/api/v1/contacts/create',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('API_KEY_LOOPS')}`,
      },
      body: JSON.stringify(body),
    }
  )
}

serve(async (req) => {
  /**
   * Creates a new contact in Loops.so on a new created user in users table.
   */
  const data = await req.json()
  const userEmail = data.record.email

  console.log(`New user with email: ${userEmail} created`)

  const errors: {
    service: 'Loops' | 'Slack',
    message: string,
  }[] = []

  // Send to Loops
  const loopsResponse = await sendToLoops({
    email: userEmail,
    userGroup: 'Authenticated'
  })
  if (loopsResponse.ok) {
    console.log('Successfully sent email to Loops')
  } else {
    const errMessage = await loopsResponse.text()
    errors.push({
      service: 'Loops',
      message: errMessage,
    })
  }

  // Send Slack message
  try {
    await sendSlackMessage(userEmail)
    console.log('Successfully sent Slack message')
  }
  catch (error) {
    console.error(`Failed to send Slack message: ${error}`)
    errors.push({
      service: 'Slack',
      message: error.message,
    })
  }

  if (errors.length == 0) {
    return new Response(undefined, { status: 200 })
  } else {
    return new Response(JSON.stringify(errors), { status: 400 })
  }
})
