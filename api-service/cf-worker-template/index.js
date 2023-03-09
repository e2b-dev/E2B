import { Router } from 'itty-router'


const router = Router()

async function handlepostRequest(request) {
    // Get the email from the request JSON payload
		const b = await request.json()
    const email = b.email

    // Check if the email is valid
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

    // If the email isn't valid, respond with JSON containing the error message
    if (!isValidEmail) {
        return new Response(JSON.stringify({
            error: 'Invalid email'
        }), {
            status: 400
        })
    }

    // If the email is valid respond with JSON and payload containing "Ok"
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

