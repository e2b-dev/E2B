import { expect } from 'vitest'

import { sandboxTest } from '../setup'

sandboxTest('log', async ({ sandbox }) => {
  const code = `
import numpy as np
import matplotlib.pyplot as plt

# Generate x values
x = np.linspace(0, 100, 100)
# Calculate y values
y = np.exp(x)

# Create the plot
plt.figure(figsize=(10, 6))
plt.plot(x, y, label='y = e^x')

# Set log scale for the y-axis
plt.yscale('log')

# Add labels and title
plt.xlabel('X-axis')
plt.ylabel('Y-axis (log scale)')
plt.title('Chart with Log Scale on Y-axis')

plt.legend()
plt.grid(True)
plt.show()
`

  const result = await sandbox.runCode(code)
  const chart = result.results[0].chart
  expect(chart).toBeDefined()
  expect(chart.type).toBe('line')

  expect(chart.title).toBe('Chart with Log Scale on Y-axis')

  expect(chart.x_label).toBe('X-axis')
  expect(chart.y_label).toBe('Y-axis (log scale)')

  expect(chart.x_unit).toBeNull()
  expect(chart.y_unit).toBe('log scale')

  expect(chart.x_scale).toBe('linear')
  expect(chart.y_scale).toBe('log')

  expect(chart.x_ticks.every((x) => typeof x === 'number')).toBe(true)
  expect(chart.y_ticks.every((y) => typeof y === 'number')).toBe(true)

  expect(chart.x_tick_labels.every((x) => typeof x === 'string')).toBe(true)
  expect(chart.y_tick_labels.every((y) => typeof y === 'string')).toBe(true)

  const lines = chart.elements
  expect(lines.length).toBe(1)

  const line = lines[0]
  expect(line.label).toBe('y = e^x')
  expect(line.points.length).toBe(100)

  expect(
    line.points.every(
      ([x, y]) => typeof x === 'number' && typeof y === 'number'
    )
  ).toBe(true)
})
