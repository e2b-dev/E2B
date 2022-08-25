import { Session } from '../dist/cjs/index.js'

async function main() {
  const session = new Session({
    debug: true,
  })

  try {
    await session.open()
    await new Promise()
  } catch (e) {
    console.error(e)
  }
}

main()
