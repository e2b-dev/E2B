import { Router } from 'itty-router'

const router = Router()

async function handlepostRequest(request) {
    const { email } = await request.json();
    if (!/^\S+@\S+$/.test(email)) {
        return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
    }
    return new Response(JSON.stringify({ message: 'Ok' }));
}

router.post('/', handlepostRequest)
router.get('*', () => new Response('Not found', { status: 404 }))

export default {
  fetch: router.handle
}