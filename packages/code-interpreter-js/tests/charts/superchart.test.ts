import { expect } from 'vitest'

import { sandboxTest } from '../setup'

sandboxTest('superchart', async ({ sandbox }) => {
  const code = `
import matplotlib.pyplot as plt
import numpy as np

# Data for plotting
x1 = np.linspace(0, 10, 100)
y1 = np.sin(x1)

# Create a figure with multiple subplots
fig, axs = plt.subplots(1, 2, figsize=(10, 8))
fig.suptitle('Multiple Charts Example', fontsize=16)

# Plotting on the different axes
axs[0].plot(x1, y1, 'r')
axs[0].set_title('Sine Wave')
axs[0].grid(True)

N = 5
x2 = np.random.rand(N)
y2 = np.random.rand(N)

axs[1].scatter(x2, y2, c='blue', label='Dataset 1')
axs[1].set_xlabel('X')
axs[1].set_ylabel('Y')
axs[1].set_title('Scatter Plot')
axs[1].grid(True)

plt.show()
`
  const result = await sandbox.runCode(code)
  const chart = result.results[0].chart

  expect(chart).toBeDefined()
  expect(chart.type).toBe('superchart')
  expect(chart.title).toBe('Multiple Charts Example')

  const charts = chart.elements
  expect(charts.length).toBe(2)

  const [firstChart, secondChart] = charts

  // Check the first chart (LineChart)
  expect(firstChart.title).toBe('Sine Wave')
  expect(firstChart.type).toBe('line')

  expect(firstChart.x_label).toBeNull()
  expect(firstChart.y_label).toBeNull()
  expect(firstChart.elements.length).toBe(1)
  expect(firstChart.elements[0].points.length).toBe(100)

  // Check the second chart (ScatterChart)
  expect(secondChart.title).toBe('Scatter Plot')
  expect(secondChart.type).toBe('scatter')

  expect(secondChart.x_label).toBe('X')
  expect(secondChart.y_label).toBe('Y')
  expect(secondChart.elements.length).toBe(1)
  expect(secondChart.elements[0].points.length).toBe(5)
})
