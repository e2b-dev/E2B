import { Session } from '../dist/cjs/index.js'

async function main() {
  const session = new Session('cCDxnr1s7su3', {
    onStateChange(state) {
      console.log(state)
    },
    onStderr(stderr) {
      console.log(stderr)
    },
    onStdout(stdout) {
      console.log(stdout)
    },
  },
    true,
  )

  try {
    await session.connect()

    await session.run(String.raw`
    const http = require('http');

const requestListener = function (req, res) {
  res.writeHead(200);
  res.end('Hello, World!');
}

const server = http.createServer(requestListener);
server.listen(8080, () => {
  console.log('Listening on 8080')
});`)

  } catch (e) {
    console.error(e)
  }
}

main()
