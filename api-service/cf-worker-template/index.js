import { Router } from 'itty-router'

const router = Router()

async function handlepostRequest(request) {
    const data = await request.json();
    const { email } = data;
    const regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!regex.test(String(email).toLowerCase())) {
        return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
    }
    return new Response(JSON.stringify({ message: 'Ok' }), { status: 200 });
}

router.post('/', handlepostRequest)
router.get('*', () => new Response('Not found', { status: 404 }))

export default {
  fetch: router.handle
}