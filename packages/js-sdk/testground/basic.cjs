const e2b = require('../dist')
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  for (let i = 0; i < 10; i++) {
    console.log('Creating sandbox', i + 1)
    e2b.Sandbox.create({id: 'base', apiKey: process.env.E2B_API_KEY})
  }
  await e2b.Sandbox.create({id: 'base', apiKey: process.env.E2B_API_KEY})

}

main().catch(console.error)

