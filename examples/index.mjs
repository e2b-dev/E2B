import { Session } from '../dist/cjs/index.js'

async function main() {
  const session = new Session('cCDxnr1s7su3', {
    onStateChange(state) {
      console.log(state)
    },
    onStderr(stderr) {
      console.log(stderr)
    },
    onStdout(stdout) {
      console.log(stdout)
    },
  },
    true,
  )

  try {
    await session.connect()

    await session.run('console.log("----------")')

  } catch (e) {
    console.error(e)
  }
}

main()
