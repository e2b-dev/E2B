import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Created via https://slack.com/apps/new/A0F7XDUAZ-incoming-webhooks
const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_USER_SIGNUP_WEBHOOK_URL')
if (!SLACK_WEBHOOK_URL) {
  throw new Error(
    'Missing SLACK_NEW_USER_FEEDBACK_APP_OAUTH_TOKEN environment variable'
  )
}
const SLACK_CHANNEL = 'user-signups'

function sendSlackMessage(email: string) {
  const message = `:fire: *New User Signed Up *\n*User*\n${email}\n`

  return fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: SLACK_CHANNEL,
      text: message,
    }),
  })
}

function sendToLoops(body: any) {
  return fetch('https://app.loops.so/api/v1/contacts/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${Deno.env.get('API_KEY_LOOPS')}`,
    },
    body: JSON.stringify(body),
  })
}

serve(async (req) => {
  /**
   * Creates a new contact in Loops.so on a new created user in users table.
   */
  const data = await req.json()
  const userRecord = data.record
  const userEmail = userRecord.email

  console.log(`New user with email: ${userEmail} created`)

  const errors: {
    service: 'Loops' | 'Slack'
    message: string
  }[] = []

  // Send to Loops
  const loopsResponse = await sendToLoops({
    email: userEmail,
    userGroup: 'Authenticated',
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
  } catch (error) {
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
