import { Router } from 'itty-router'

const router = Router()

async function handlepostRequest(request, env) {
    const botAccessToken = env.SLACK_BOT_ACCESS_TOKEN;
    const SlackREST = require('@sagi.io/workers-slack')
    const SlackAPI = new SlackREST({ botAccessToken })

    const data = { channel: 'general', text: `User '${request.email}' selected pricing '${request.selectedPricing.type}' for $${request.selectedPricing.cost}` }
    const result = await SlackAPI.chat.postMessage(data)

    return new Response('Ok', { status: 200 })
}

router.post('/', handlepostRequest)
router.get('*', () => new Response('Not found', { status: 404 }))

export default {
  fetch: router.handle
}