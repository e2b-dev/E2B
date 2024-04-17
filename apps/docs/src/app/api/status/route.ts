import { Sandbox } from 'e2b'

export const dynamic = 'force-dynamic' // static by default, unless reading the request
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log('Creating sandbox...')
    // E2B_DOMAIN = e2b-api.com
    const sandbox = await Sandbox.create({
      onStdout: (data) => {
        console.log('sandbox stdout:', data)
      },
      onStderr: (data) => {
        console.error('sandbox stderr:', data)
      },
    })
    console.log(`Sandbox '${sandbox.id}' created`)
    return new Response(`Sandbox '${sandbox.id}' created`, { status: 200 })
  } catch (error) {
    console.log(error)
    console.error('Error creating sandbox')
    console.error(error)
    return new Response(error.statusText || 'Error creating sandbox', { status: error.status || 500 })
  }
}

