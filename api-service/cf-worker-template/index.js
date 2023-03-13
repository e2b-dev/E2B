import { Router } from 'itty-router'

const router = Router()

async function handlepostRequest(req, env) {
  // DO NOT USE `process.env` TO ACCES ENVIRONMENT VARIABLES. Instead, you access environment variables through the `env` parameter like this: `const myEnv = env.MY_ENV`.
  // You have access to the following environment variables:
  // const SLACK_BOT_ACCESS_TOKEN = `env.SLACK_BOT_ACCESS_TOKEN`


  // The incoming request content-type is application/json. Make sure to correctly retrieve it.
  const requestBody = req.json()
  const botAccessToken = env.SLACK_BOT_ACCESS_TOKEN;
  const SlackREST = require('@sagi.io/workers-slack')
  const SlackAPI = new SlackREST({ botAccessToken })

  const data = {
    channel: 'general',
    text: `User '${requestBody.email}' selected pricing '${requestBody.selectedPricing.type}' for $${requestBody.selectedPricing.cost}`
  }
  const result = await SlackAPI.chat.postMessage(data)

  return new Response('Ok', { status: 200 })
}

router.post('/', handlepostRequest)
router.get('*', () => new Response('Not found', { status: 404 }))

export default {
  fetch: router.handle
}