import { expect } from 'vitest'

import { sandboxTest } from '../setup'

sandboxTest('box-and-whisker', async ({ sandbox }) => {
  const code = `
import matplotlib.pyplot as plt
import numpy as np

# Sample data
data = {
    'Class A': [85, 90, 78, 92, 88],
    'Class B': [95, 89, 76, 91, 84, 87],
    'Class C': [75, 82, 88, 79, 86]
}

# Create figure and axis
fig, ax = plt.subplots(figsize=(10, 6))

# Customize plot
ax.set_title('Exam Scores Distribution')
ax.set_xlabel('Class')
ax.set_ylabel('Score')

# Set custom colors
ax.boxplot(data.values(), labels=data.keys(), patch_artist=True)

# Add legend
ax.legend()

# Adjust layout and show plot
plt.tight_layout()
plt.show()
`
  const result = await sandbox.runCode(code)
  const chart = result.results[0].chart

  expect(chart).toBeDefined()

  expect(chart.type).toBe('box_and_whisker')
  expect(chart.title).toBe('Exam Scores Distribution')

  expect(chart.x_label).toBe('Class')
  expect(chart.y_label).toBe('Score')

  expect(chart.x_unit).toBeNull()
  expect(chart.y_unit).toBeNull()

  const bars = chart.elements
  expect(bars.length).toBe(3)

  expect(bars.map((bar) => bar.label)).toEqual([
    'Class A',
    'Class B',
    'Class C',
  ])
  expect(bars.map((bar) => bar.outliers)).toEqual([[], [76], []])
  expect(bars.map((bar) => bar.min)).toEqual([78, 84, 75])
  expect(bars.map((bar) => bar.first_quartile)).toEqual([85, 84.75, 79])
  expect(bars.map((bar) => bar.median)).toEqual([88, 88, 82])
  expect(bars.map((bar) => bar.third_quartile)).toEqual([90, 90.5, 86])
  expect(bars.map((bar) => bar.max)).toEqual([92, 95, 88])
})
