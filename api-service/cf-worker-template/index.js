import { Router } from 'itty-router'

const router = Router()

async function handlepostRequest(request) {
    const { value, from, to } = request.json();
    const app_id = "79d294dc12da4ff4921bb943b1a7a45c";
    const url = `https://openexchangerates.org/api/convert/${value}/${from}/${to}?app_id=${app_id}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return new Response(JSON.stringify(data));
    } catch (err) {
        return new Response(JSON.stringify(err));
    }
}

router.post('/', handlepostRequest)
router.get('*', () => new Response('Not found', { status: 404 }))

export default {
  fetch: router.handle
}