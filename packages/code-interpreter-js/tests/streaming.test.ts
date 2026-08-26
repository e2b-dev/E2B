import { expect } from 'vitest'

import { Result, OutputMessage } from '../src'

import { sandboxTest } from './setup'

sandboxTest('streaming output', async ({ sandbox }) => {
  const out: OutputMessage[] = []
  await sandbox.runCode('print(1)', {
    onStdout: (msg) => out.push(msg),
  })

  expect(out.length).toEqual(1)
  expect(out[0].line).toEqual('1\n')
})

sandboxTest('streaming error', async ({ sandbox }) => {
  const out: OutputMessage[] = []
  await sandbox.runCode('import sys;print(1, file=sys.stderr)', {
    onStderr: (msg) => out.push(msg),
  })

  expect(out.length).toEqual(1)
  expect(out[0].line).toEqual('1\n')
})

sandboxTest('streaming result', async ({ sandbox }) => {
  const out: Result[] = []
  const code = `
        import matplotlib.pyplot as plt
        import numpy as np

        x = np.linspace(0, 20, 100)
        y = np.sin(x)

        plt.plot(x, y)
        plt.show()

        x
        `
  await sandbox.runCode(code, {
    onResult: (result) => out.push(result),
  })

  expect(out.length).toEqual(2)
})
