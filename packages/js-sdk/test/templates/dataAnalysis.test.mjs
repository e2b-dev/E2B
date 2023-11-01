import { DataAnalysis } from '../../src'
import { expect, test } from 'vitest'

test('test_data_analysis', async () => {
  const sandbox = await DataAnalysis.create()
  const result = await sandbox.runPython(
    `
import matplotlib.pyplot as plt

plt.plot([1, 2, 3, 4])
plt.ylabel('some numbers')
plt.show()
    `,
  )
  await sandbox.close()
  expect(result.artifacts.length).toEqual(1)
}, 10000)
