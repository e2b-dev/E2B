import { assert } from 'vitest'
import { sandboxTest } from '../../setup.js'

sandboxTest('send stdin to process', async ({ sandbox }) => {
  const text = 'Hello, World!'
  const cmd = await sandbox.commands.run('cat', {
    background: true,
    stdin: true,
  })

  await sandbox.commands.sendStdin(cmd.pid, text)

  for (let i = 0; i < 5; i++) {
    if (cmd.stdout === text) {
      break
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  await cmd.kill()

  assert.equal(cmd.stdout, text)
})

sandboxTest('send stdin via command handle', async ({ sandbox }) => {
  const text = 'Hello, World!'
  const cmd = await sandbox.commands.run('cat', {
    background: true,
    stdin: true,
  })

  await cmd.sendStdin(text)

  for (let i = 0; i < 5; i++) {
    if (cmd.stdout === text) {
      break
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  await cmd.kill()

  assert.equal(cmd.stdout, text)
})

sandboxTest('close stdin via command handle', async ({ sandbox }) => {
  const text = 'Hello, World!'
  const cmd = await sandbox.commands.run('cat', {
    background: true,
    stdin: true,
  })

  await cmd.sendStdin(text)
  await cmd.closeStdin()

  // `cat` exits once stdin is closed (EOF).
  const result = await cmd.wait()

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, text)
})

sandboxTest('send empty stdin to process', async ({ sandbox }) => {
  const text = ''
  const cmd = await sandbox.commands.run('cat', {
    background: true,
    stdin: true,
  })

  await sandbox.commands.sendStdin(cmd.pid, text)

  await cmd.kill()

  assert.equal(cmd.stdout, text)
})

sandboxTest('send special characters to stdin', async ({ sandbox }) => {
  const text = '!@#$%^&*()_+'
  const cmd = await sandbox.commands.run('cat', {
    background: true,
    stdin: true,
  })

  await sandbox.commands.sendStdin(cmd.pid, text)

  for (let i = 0; i < 5; i++) {
    if (cmd.stdout === text) {
      break
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  await cmd.kill()

  assert.equal(cmd.stdout, text)
})

sandboxTest('send multiline string to stdin', async ({ sandbox }) => {
  const text = 'Hello,\nWorld!'
  const cmd = await sandbox.commands.run('cat', {
    background: true,
    stdin: true,
  })

  await sandbox.commands.sendStdin(cmd.pid, text)

  for (let i = 0; i < 5; i++) {
    if (cmd.stdout === text) {
      break
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  await cmd.kill()

  assert.equal(cmd.stdout, text)
})
