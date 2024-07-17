import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  template: 'base',
  envVars: {FOO: 'Hello'}, // $HighlightLine
})

await sandbox.close()
