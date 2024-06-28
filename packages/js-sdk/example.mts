import { Sandbox } from './dist'

const sbx = await Sandbox.create('3pcmtxu6u8it5f6flpkk', {
  debug: true,
  // domain: 'e2b-staging.com',
  // timeoutMs: 5_000,
  // logger: console,
})

const res = await sbx.files.list('/', { user: 'adada' })
// console.log(res)

// const l = await sbx.commands.list()

// console.log(l)

// // console.log('time', Date.now() - start)

// async function wait(ms: number) {
//   return new Promise((resolve) => setTimeout(resolve, ms))
// }

// for (let i = 0; i < 10; i++) {
//   const lStart = Date.now()
//   await wait(10000)

//   const res = await sbx.files.list('/')

//   console.log('time', Date.now() - lStart)
// }


// // const watcher = await sbx.files.watch('./', (e) => {
// //   console.log(e)
// // }, {
// //   // onExit: (err) => {
// //   //   console.log('watcher exited', err)
// //   // },
// //   // timeout: 1000,
// //   // requestTimeoutMs: 1,
// // })

// // await sbx.files.write('test', 'hello world')
// // const contents = await sbx.files.read('test')
// // console.log(contents)

// // await watcher.stop()


// // const pStart = Date.now()

// // await sbx.commands.run('python3 -m http.server -b 127.0.0.1 8090', {
// // await sbx.commands.run('echo "c"', {
// //   background: false,
// //   // user: 'root',
// //   onStdout: (data) => {
// //     console.log('event0', data)
// //   },
// // })

// // console.log('time', Date.now() - pStart)

// // await wait(3000)

// // const res = await fetch(`https://${sbx.getHost(8090)}`)

// // console.log(await res.text())


// // const lStart = Date.now()

// // await sbx.files.makeDir('test')

// // console.log('time', Date.now() - lStart)

// // const rStart = Date.now()

// // await sbx.files.makeDir('test')
// // // await sbx.files.read('test')

// // console.log('time', Date.now() - rStart)
// // const xStart = Date.now()

// // await sbx.files.makeDir('test')
// // // await sbx.files.read('test')

// // console.log('time', Date.now() - xStart)
// // const yStart = Date.now()

// // await sbx.files.makeDir('test')
// // // await sbx.files.read('test')

// // console.log('time', Date.now() - yStart)

// // // await sbx.commands.sendStdin(c.pid, 'hello world\n')

// // // console.log(res)

// // // await sbx.files.makeDir('test')

// // // const contents2 = await sbx.files.exists('%%\\test')
// // // console.log(contents2)

// // // watcher.stop()


// // // const start = Date.now()

// // // const res = await sbx.commands.list()
// // // console.log(res)

// // // const res = await fetch('http://localhost:49982/sync', {
// // //   method: 'POST',
// // // })

// // // const q = await res.text()
// // // console.log(q)


// // // const res = await sbx.commands.run('sleep 5 && echo hello', {
// // //   background: true,
// // //   onStdout: (data) => {
// // //     console.log('event0', data)
// // //   },
// // // })

// // // async function wait(ms: number) {
// // //   return new Promise((resolve) => setTimeout(resolve, ms))
// // // }

// // // // const r2 = await sbx.commands.connect(res.pid, {
// // // //   onStdout: (data) => {
// // // //     console.log('event1', data)
// // // //   },
// // // // })
// // // await wait(2000)
// // // await res.kill()

// // // console.log('time', Date.now() - start)
