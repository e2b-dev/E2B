import { Session } from '../dist/cjs/index.js'

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const session = new Session('test')

  try {
    await session.connect()
    await session.subscribe('state', (data) => {
      console.log(data)
    })

    await session.subscribe('stderr', (data) => {
      console.log(data)
    })

    await session.subscribe('stdout', (data) => {
      console.log(data)
    })

    String.raw
    await session.run('console.log("\n4")')

    console.log('run')
    await wait(4000)

  } catch (e) {
    console.error(e)
  }
}

main()
