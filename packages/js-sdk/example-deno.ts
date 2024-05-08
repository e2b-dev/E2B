import { CodeInterpreter } from 'npm:@e2b/code-interpreter@0.0.4-deno.0'

const sandbox = await CodeInterpreter.create({
  logger: console,
})
console.log(sandbox.id)

const r = await sandbox.notebook.execCell('x = 1; x')
console.log(r)

const file = await sandbox.filesystem.list('/')
console.log(file)


await sandbox.close()
