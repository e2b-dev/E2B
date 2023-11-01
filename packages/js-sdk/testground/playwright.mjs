import { Sandbox } from '../dist/index.js' // should be /esm/, but getting "The requested module '../dist/esm/index.js' is a CommonJS module"

const commonProcessOpts = {
  onStdout: ({ line }) => console.log('🟢', line),
  onStderr: ({ line }) => console.log('🔴', line)
}

const sandbox = await Sandbox.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY
})

console.log('🟣 Creating package.json')
await (
  await sandbox.process.start({
    cmd: 'npx playwright install',
    ...commonProcessOpts
  })
).finished

console.log('🟣 Running playwright --version')
await (
  await sandbox.process.start({
    cmd: 'npx playwright --version',
    ...commonProcessOpts
  })
).finished

await sandbox.close()
