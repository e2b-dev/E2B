import { Session } from '../dist/cjs/index.js'

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const session = new Session('/fgc-vm')

  try {
    await session.connect()

    await wait(3000)

  } catch (e) {
    console.error(e)
  }
}

main()
