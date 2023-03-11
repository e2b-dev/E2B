import { Router } from 'itty-router'

const router = Router()

async function handlegetRequest(request, env) {
  const responseBody = {
    API_KEY: env.API_KEY,
    ANOTHER_KEY: env.ANOTHER_KEY
  }

  return new Response(JSON.stringify(responseBody), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

router.get('/', handlegetRequest)
router.get('*', () => new Response('Not found', { status: 404 }))

export default {
  fetch: router.handle
}