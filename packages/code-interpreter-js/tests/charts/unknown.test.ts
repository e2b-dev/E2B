import { expect } from 'vitest'

import { sandboxTest } from '../setup'

// Skip this test if we are running in debug mode — the pwd and user in the testing docker container are not the same as in the actual sandbox.
sandboxTest('unknown', async ({ sandbox }) => {
  const code = `
import matplotlib.pyplot as plt
import numpy as np

# Create a figure and an axis
fig, ax = plt.subplots()

# Create data for two concentric circles
circle1 = plt.Circle((0, 0), 1, color='blue', fill=False, linewidth=2)
circle2 = plt.Circle((0, 0), 2, color='red', fill=False, linewidth=2)

# Add the circles to the axes
ax.add_artist(circle1)
ax.add_artist(circle2)

# Set grid
ax.grid(True)

# Set title
plt.title('Two Concentric Circles')

# Show the plot
plt.show()
`
  const result = await sandbox.runCode(code)
  const chart = result.results[0].chart

  expect(chart).toBeDefined()
  expect(chart.type).toBe('unknown')
  expect(chart.title).toBe('Two Concentric Circles')

  expect(chart.elements.length).toBe(0)
})
