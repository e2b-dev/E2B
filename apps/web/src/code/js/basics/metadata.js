import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  template: 'base',
  metadata: { userID: 'uniqueID' }   // $HighlightLine
})
// Keep the sandbox alive for 60 seconds
await sandbox.keepAlive(60_000)
// You can even close the script

// Later, can be even from another process
// List all running sandboxes
const paginator = Sandbox.list({ query: {state: ['running']}})
const runningSandboxes = await paginator.nextItems()
// Find the sandbox by metadata
const found = runningSandboxes.find(s => s.metadata?.userID === 'uniqueID')
if (found) {
  // Sandbox found, we can reconnect to it
  const sandbox = await Sandbox.reconnect(found.sandboxID)
} else {
  // Sandbox not found
}

await sandbox.close()
