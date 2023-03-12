import { Router, Response } from 'itty-router'
import { isEmail } from 'validator'
import { db } from 'supabase'

const router = Router()

async function handlepostRequest(request, env) {
  const { email } = await request.json()
  if (!isEmail(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 })
  }
  await db.query(`INSERT INTO users (email) VALUES ($1)`, [email])
  return new Response(JSON.stringify({ message: 'Ok' }))
}

router.post('/', handlepostRequest)
router.get('*', () => new Response('Not found', { status: 404 }))

export default {
  fetch: router.handle
}
