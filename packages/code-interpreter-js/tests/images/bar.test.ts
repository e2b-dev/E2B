import { expect } from 'vitest'

import { sandboxTest } from '../setup'

// Skip this test if we are running in debug mode — the pwd and user in the testing docker container are not the same as in the actual sandbox.
sandboxTest('test show image', async ({ sandbox }) => {
  const code = `
    import numpy
    from PIL import Image

    imarray = numpy.random.rand(16,16,3) * 255
    image = Image.fromarray(imarray.astype('uint8')).convert('RGBA')

    image.show()
    print("done")
    `

  const execution = await sandbox.runCode(code)

  const image = execution.results[0].png
  expect(image).toBeDefined()
})

sandboxTest('test image represent', async ({ sandbox }) => {
  const code = `
    import numpy
    from PIL import Image

    imarray = numpy.random.rand(16,16,3) * 255
    image = Image.fromarray(imarray.astype('uint8')).convert('RGBA')

    image
    `
  const execution = await sandbox.runCode(code)

  const image = execution.results[0].png
  expect(image).toBeDefined()
})

sandboxTest('get image on save', async ({ sandbox }) => {
  const code = `
    import numpy
    from PIL import Image

    imarray = numpy.random.rand(16,16,3) * 255
    image = Image.fromarray(imarray.astype('uint8')).convert('RGBA')

    image.save("test.png")
    `

  const execution = await sandbox.runCode(code)

  const image = execution.results[0].png
  expect(image).toBeDefined()
})
