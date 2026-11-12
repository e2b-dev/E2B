import { expect, test } from 'vitest'

import { Execution, parseOutput } from '../src/messaging'

test.each([{}, { columns: ['answer'], rows: [[42]] }, undefined])(
  'preserves result data through Execution JSON serialization: %j',
  async (data) => {
    const execution = new Execution()
    await parseOutput(
      execution,
      JSON.stringify({
        type: 'result',
        text: 'table',
        is_main_result: true,
        data,
      })
    )

    const serialized = JSON.parse(JSON.stringify(execution))
    if (data === undefined) {
      expect(serialized.results[0]).not.toHaveProperty('data')
    } else {
      expect(execution.results[0].formats()).toContain('data')
      expect(serialized.results[0].data).toEqual(data)
    }
    expect(serialized.results[0].text).toBe('table')
  }
)

test.each([
  {
    type: 'bar',
    title: 'Book Sales by Authors',
    x_label: 'Authors',
    y_label: 'Number of Books Sold',
    elements: [{ label: 'Author A', group: 'Books Sold', value: 100 }],
  },
  undefined,
])(
  'preserves result chart through Execution JSON serialization: %j',
  async (chart) => {
    const execution = new Execution()
    await parseOutput(
      execution,
      JSON.stringify({
        type: 'result',
        text: '<Figure size 1000x600 with 1 Axes>',
        is_main_result: false,
        chart,
      })
    )

    const serialized = JSON.parse(JSON.stringify(execution))
    if (chart === undefined) {
      expect(serialized.results[0]).not.toHaveProperty('chart')
    } else {
      expect(serialized.results[0].chart).toEqual(chart)
    }
  }
)
