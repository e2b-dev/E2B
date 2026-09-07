import { expect, test } from 'vitest'

import { ChartType, deserializeChart } from '../../src/charts'
import { Result } from '../../src/messaging'

const superchartPayload = {
  type: ChartType.SUPERCHART,
  title: 'Multiple Charts Example',
  elements: [
    {
      type: ChartType.LINE,
      title: 'Sine Wave',
      elements: [],
    },
    {
      type: 'not-a-chart',
      title: 'nested',
      elements: [],
    },
  ],
}

test('deserializeChart walks SuperChart.elements', () => {
  const chart = deserializeChart(superchartPayload)

  expect(chart.type).toBe(ChartType.SUPERCHART)
  expect(chart.elements).toHaveLength(2)
  expect(chart.elements[0].title).toBe('Sine Wave')
  expect(chart.elements[0].type).toBe(ChartType.LINE)
  expect(chart.elements[1].type).toBe(ChartType.UNKNOWN)
  expect(chart).not.toHaveProperty('data')
})

test('Result tags nested unknown SuperChart members', () => {
  const result = new Result({ chart: superchartPayload }, true)

  expect(result.chart?.type).toBe(ChartType.SUPERCHART)
  expect(result.chart?.elements[1].type).toBe(ChartType.UNKNOWN)
})
