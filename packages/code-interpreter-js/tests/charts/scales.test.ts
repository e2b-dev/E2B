import { expect } from 'vitest'

import { sandboxTest } from '../setup'
sandboxTest('datetime scale', async ({ sandbox }) => {
  const code = `
    import numpy as np
    import matplotlib.pyplot as plt
    import datetime

    # Generate x values
    dates = [datetime.date(2023, 9, 1) + datetime.timedelta(seconds=i) for i in range(100)]
    y_sin = np.sin(np.linspace(0, 2*np.pi, 100))

    # Create the plot
    plt.figure(figsize=(10, 6))
    plt.plot(dates, y_sin, label='sin(x)')
    plt.show()
    `

  const result = await sandbox.runCode(code)

  const chart = result.results[0].chart
  expect(chart).toBeDefined()
  expect(chart.type).toBe('line')

  expect(chart.x_scale).toBe('datetime')
  expect(chart.y_scale).toBe('linear')
})

sandboxTest('categorical scale', async ({ sandbox }) => {
  const code = `
    import numpy as np
    import matplotlib.pyplot as plt

    x = [1, 2, 3, 4, 5]
    y = ['A', 'B', 'C', 'D', 'E']

    # Create the plot
    plt.figure(figsize=(10, 6))
    plt.plot(x, y)
    plt.show()
    `

  const result = await sandbox.runCode(code)

  const chart = result.results[0].chart
  expect(chart).toBeTruthy()

  expect(chart.type).toBe('line')
  expect(chart.x_scale).toBe('linear')
  expect(chart.y_scale).toBe('categorical')
})
