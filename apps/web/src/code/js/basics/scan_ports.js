import { Sandbox } from 'e2b'

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

// List of ports that have already been printed
const printedPorts = []

// The logs will look similar to this:
// ip='0.0.0.0'      port=49982  state='LISTEN'      https://49982-smob7j0j-fce131d5.ondevbook.com
// ip='0.0.0.0'      port=22     state='LISTEN'      https://22-smob7j0j-fce131d5.ondevbook.com
// ip='169.254.0.21' port=49982  state='ESTABLISHED' https://49982-smob7j0j-fce131d5.ondevbook.com
// ip='127.0.0.53'   port=53     state='LISTEN'      https://53-smob7j0j-fce131d5.ondevbook.com
// ip='0.0.0.0'      port=8000   state='LISTEN'      https://8000-smob7j0j-fce131d5.ondevbook.com
function printNewPortAndURL(openPorts, sandbox) {
  openPorts.forEach((port) => {
    if (!printedPorts.includes(port.port)) {
      printedPorts.push(port.port)
      console.log(port, `https://${sandbox.getHostname(port.port)}`)
    }
  })
}

const sandbox = await Sandbox.create({
  template: 'base',
  onScanPorts: (openPorts) => printNewPortAndURL(openPorts, sandbox), // $HighlightLine
})

// Start a new server on port 8000 inside the playground.
const proc = await sandbox.process.start({
  cmd: 'python3 -m http.server 8000',
}) // $HighlightLine

// Wait 10 seconds and then kill the server and close the sandbox.
await sleep(10000)
await proc.kill()
await sandbox.close()

await sandbox.close()
