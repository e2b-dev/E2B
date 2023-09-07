const e2b = require("../dist/cjs/index")

async function main() {
  const session = await e2b.Session.create({
    id: 'Nodejs',
    apiKey: process.env.E2B_API_KEY
  })
  
  const { stdout: time } = await (await session.process.start({ cmd: `echo $(date)` })).finished
  console.log(time)

  // Thanks to refreshing in the service worker, this should not cause the session to close
  blockingSleep(20000)
  
  const { stdout: time2 } = await (await session.process.start({ cmd: `echo $(date)` })).finished
  console.log(time)

  await session.close()
}

main().catch(console.error)

function blockingSleep(sleepDuration){
  let now = new Date().getTime();
  while(new Date().getTime() < now + sleepDuration){
    /* Do nothing */
  }
}

