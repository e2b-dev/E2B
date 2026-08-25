import { expect } from 'vitest'

import { sandboxTest } from '../setup'

sandboxTest('pie', async ({ sandbox }) => {
  const code = `
import matplotlib.pyplot as plt
import numpy as np

# Step 1: Define the data for the pie chart
categories = ["No", "No, in blue"]
sizes = [90, 10]

# Step 2: Create the figure and axis objects
fig, ax = plt.subplots(figsize=(8, 8))

plt.xlabel("x")
plt.ylabel("y")

# Step 3: Create the pie chart
ax.pie(sizes, labels=categories, autopct='%1.1f%%', startangle=90, colors=plt.cm.Pastel1.colors[:len(categories)])

# Step 4: Add title and legend
ax.axis('equal')  # Equal aspect ratio ensures that pie is drawn as a circle
plt.title('Will I wake up early tomorrow?')

# Step 5: Show the plot
plt.show()
`
  const result = await sandbox.runCode(code)
  const chart = result.results[0].chart

  expect(chart).toBeDefined()
  expect(chart.type).toBe('pie')

  expect(chart.title).toBe('Will I wake up early tomorrow?')

  expect(chart.elements.length).toBe(2)

  const [firstData, secondData] = chart.elements

  expect(firstData.label).toBe('No')
  expect(firstData.angle).toBe(324) // 90% of 360 degrees
  expect(firstData.radius).toBe(1)

  expect(secondData.label).toBe('No, in blue')
  expect(secondData.angle).toBe(36) // 10% of 360 degrees
  expect(secondData.radius).toBe(1)
})
