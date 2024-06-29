
import { sandboxTest } from '../setup.js'

sandboxTest('upload file via url', async ({ sandbox }) => {
  const url = sandbox.uploadUrl()


})

sandboxTest('upload file via url to specific path', async ({ sandbox }) => {
  const url = sandbox.uploadUrl('/test/test.txt')

  const res = await fetch(url)

  assert.equal(res.status, 200)
})
