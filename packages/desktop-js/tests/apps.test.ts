import { sandboxTest } from './setup'

sandboxTest('open with default app', async ({ sandbox }) => {
  // TODO: Implement

  // Create a new text file
  const filePath = '/home/user/testfile.txt'
  await sandbox.commands.run(`echo "This is a test file." > ${filePath}`)

  // Open with a default app
  await sandbox.open(filePath)
})
