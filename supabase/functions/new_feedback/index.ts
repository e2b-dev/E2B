import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { WebClient } from 'https://deno.land/x/slack_web_api@6.7.2/mod.js'

const SLACK_API_TOKEN = Deno.env.get('SLACK_NEW_USER_FEEDBACK_APP_OAUTH_TOKEN')
if (!SLACK_API_TOKEN) {
  throw new Error('Missing SLACK_NEW_USER_FEEDBACK_APP_OAUTH_TOKEN environment variable')
}
const SLACK_CHANNEL = 'users'

console.log('Will create slack client')

const slackClient = new WebClient(SLACK_API_TOKEN)

console.log('Slack client created')

function sendSlackMessage(email: string, feedback: string) {
  const message = `:rotating_light: @here *New User Feedback From Dashboard*\n*User*\n${email}\n*Feedback*\n>${feedback}`

  return slackClient.chat.postMessage({
    channel: SLACK_CHANNEL,
    text: message,
    link_names: true,
  })
}

serve(async (req) => {
  /**
   * Sends a Slack message to the configured channel when a new feedback is created.
  */
  const data = await req.json()
  const {
    record: { email, text },
  } = data
  console.log(`New feedback from '${email}' received: '${text}'`)

  try {
    await sendSlackMessage(email, text)
    console.log('Successfully sent Slack message')
    return new Response(undefined, {status: 200})
  }
  catch (error) {
    console.error(`Failed to send Slack message: ${error}`)
    const body = {
      error: 'Failed to send Slack message',
      message: error.message,
    }
    return new Response(JSON.stringify(body), {status: 400})
  }
})
