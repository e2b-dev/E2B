import { expect } from 'vitest'

import { sandboxTest } from '../setup'

sandboxTest('scatter', async ({ sandbox }) => {
  const code = `
import matplotlib.pyplot as plt
import numpy as np

# Create data
N = 5
x1 = np.random.rand(N)
y1 = np.random.rand(N)
x2 = np.random.rand(2*N)
y2 = np.random.rand(2*N)

plt.xlabel("A")
plt.ylabel("B")

plt.scatter(x1, y1, c='blue', label='Dataset 1')
plt.scatter(x2, y2, c='red', label='Dataset 2')

plt.show()
`
  const result = await sandbox.runCode(code)
  const chart = result.results[0].chart

  expect(chart).toBeDefined()
  expect(chart.type).toBe('scatter')

  expect(chart.title).toBeNull()
  expect(chart.x_label).toBe('A')
  expect(chart.y_label).toBe('B')

  expect(chart.x_ticks.every((tick: number) => typeof tick === 'number')).toBe(
    true
  )
  expect(chart.y_ticks.every((tick: number) => typeof tick === 'number')).toBe(
    true
  )

  expect(
    chart.x_tick_labels.every((label: string) => typeof label === 'string')
  ).toBe(true)
  expect(
    chart.y_tick_labels.every((label: string) => typeof label === 'string')
  ).toBe(true)

  expect(chart.elements.length).toBe(2)

  const [firstData, secondData] = chart.elements

  expect(firstData.label).toBe('Dataset 1')
  expect(firstData.points.length).toBe(5)
  expect(
    firstData.points.every(
      (point: [number, number]) =>
        typeof point[0] === 'number' && typeof point[1] === 'number'
    )
  ).toBe(true)

  expect(secondData.label).toBe('Dataset 2')
  expect(secondData.points.length).toBe(10)
  expect(
    secondData.points.every(
      (point: [number, number]) =>
        typeof point[0] === 'number' && typeof point[1] === 'number'
    )
  ).toBe(true)
})
