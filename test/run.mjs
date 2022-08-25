import { Session } from '../dist/cjs/index.js'

async function main() {
  const session = new Session({
    id: 'Nodejs',
    debug: true,
    onDisconnect() {
      console.log('disconnect')
    },
    onReconnect() {
      console.log('reconnect')
    },
    onClose() {
      console.log('close')
    },
    // __debug_hostname: '127.0.0.1',
    // __debug_devEnv: 'local',
  })

  try {
    await session.open()
    console.log('connected')

    const hostname = session.getHostname()
    console.log(hostname)
  } catch (e) {
    console.error(e)
  }
}

main()
