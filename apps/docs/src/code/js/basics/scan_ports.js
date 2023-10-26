import { Session } from '@e2b/sdk'

const sleep = ms => new Promise(res => setTimeout(res, ms))

// List of ports that have already been printed
const printedPorts = []

// The logs will look similar to this:
// ip='0.0.0.0'      port=49982  state='LISTEN'      https://49982-smob7j0j-fce131d5.ondevbook.com
// ip='0.0.0.0'      port=22     state='LISTEN'      https://22-smob7j0j-fce131d5.ondevbook.com
// ip='169.254.0.21' port=49982  state='ESTABLISHED' https://49982-smob7j0j-fce131d5.ondevbook.com
// ip='127.0.0.53'   port=53     state='LISTEN'      https://53-smob7j0j-fce131d5.ondevbook.com
// ip='0.0.0.0'      port=8000   state='LISTEN'      https://8000-smob7j0j-fce131d5.ondevbook.com
function printNewPortAndURL(openPorts, session) {
  openPorts.forEach(port => {
    if (!printedPorts.includes(port.port)) {
      printedPorts.push(port.port)
      console.log(port, `https://${session.getHostname(port.port)}`)
    }
  })
}

const session = await Session.create({
  id: 'Python3',
  onScanPorts: openPorts => printNewPortAndURL(openPorts, session), // $HighlightLine
})

// Start a new server on port 8000 inside the playground.
const proc = await session.process.start({ cmd: 'python3 -m http.server 8000' }) // $HighlightLine

// Wait 10 seconds and then kill the server and close the session.
await sleep(10000)
await proc.kill()
await session.close()

await session.close()
