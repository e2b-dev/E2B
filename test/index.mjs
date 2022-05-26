import { Session } from '../dist/cjs/index.js'

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function handleStateChange(state: 'running' | 'stopped') {
}

async function main() {
  const session = new Session('GpN3WCcvIGAQ')

  try {
    await session.connect()
    session.subscribe('state', handleStateChange)


    await wait(3000)

  } catch (e) {
    console.error(e)
  }
}

main()
