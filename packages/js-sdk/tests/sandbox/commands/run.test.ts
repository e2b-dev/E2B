import { expect, assert } from 'vitest'

import { sandboxTest } from '../../setup.js'

sandboxTest('run', async ({ sandbox }) => {
  const text = 'Hello, World!'

  const cmd = await sandbox.commands.run(`echo "${text}"`)

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout, `${text}\n`)
})

sandboxTest('run with special characters', async ({ sandbox }) => {
  const text = '!@#$%^&*()_+'

  const cmd = await sandbox.commands.run(`echo "${text}"`)

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout, `${text}\n`)
})

sandboxTest('run with multiline string', async ({ sandbox }) => {
  const text = 'Hello,\nWorld!'

  const cmd = await sandbox.commands.run(`echo "${text}"`)

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout, `${text}\n`)
})

sandboxTest('run with timeout', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('echo "Hello, World!"', { timeoutMs: 1000 })

  assert.equal(cmd.exitCode, 0)
})

sandboxTest('run with too short timeout', async ({ sandbox }) => {
  await expect(sandbox.commands.run('sleep 10', { timeoutMs: 1000 })).rejects.toThrow()
})


sandboxTest('can disconnect and reconnect with logs', async ({ sandbox }) => {
  // let reachedStart = false
  const cmd = await sandbox.commands.run(`
  echo "start"

  # some command that periodically logs to stdout 5 times
  for i in {1..2}; do
    date +%s%3N
    sleep 1
  done

  echo "end"
  `, {
    background: true,


  })


  // Here you could get the stream of stdout/stderr from command
  let { timestamp } = await cmd.disconnect()
  // Here the stdout/stderr is no longer streamed from sandbox

  let out: string[] = []

  const reconnectedCmd = await sandbox.commands.connect(
    cmd.pid,
    {
      eventsSince: timestamp,
      onStdout: e => { out.push(e) },
    }
  )

  // assert end not in out
  out.map(e => assert.notEqual(e, 'end\n'))

  // wait for the command to finish
  await reconnectedCmd.wait()

  console.log(out)

  // check the output
  // assert start not in out
  out.map(e => assert.notEqual(e, 'start\n'))
  // assert end in out
  assert(out.reduce((acc, e) => acc || e === 'end\n', false))
  const filtered = out.filter(e => e !== 'end\n').map(e => parseInt(e.trim()))
  console.log(filtered)
  console.log(timestamp)  
  let milliseconds = Date.parse(timestamp)
  console.log(milliseconds)
  assert(filtered.reduce((acc, e) => acc && (e > milliseconds), true))
})