import { Sandbox } from './dist'

const sbx = await Sandbox.create('', {
  debug: true,
})


const watcher = await sbx.files.watch('./', (e) => {
  e.path
}, {
  user: 'user',
  timeout: 2,
})


// await sbx.files.write('test', 'hello world')
// const contents = await sbx.files.read('test')
// console.log(contents)


// await sbx.files.makeDir('new-lore')

// const contents2 = await sbx.files.exists('%%\\test')
// console.log(contents2)

// watcher.stop()

const res = await sbx.commands.run('ls -a', {})
