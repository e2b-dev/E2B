import { Router } from 'itty-router'

const router = Router()

async function handlepostRequest(request, env) {
    const body = await request.json()
    const email = body.email
    console.log('email', email)
    if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        return new Response(JSON.stringify({
            error: 'Invalid email'
        }), {
            status: 400
        })
    }
    const db = new Supabase.DB(env.SUPABASE_URL)
    await db.query('INSERT INTO users (email) VALUES ($1)', [email])
    return new Response(JSON.stringify({
        message: 'Ok'
    }), {
        status: 200
    })
}

router.post('/', handlepostRequest)
router.get('*', () => new Response('Not found', { status: 404 }))

export default {
  fetch: router.handle
}