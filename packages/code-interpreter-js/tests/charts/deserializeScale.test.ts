import { expect, test } from 'vitest'

import { ChartType, deserializeChart, ScaleType } from '../../src/charts'
import { Result } from '../../src/messaging'

const pointChart = {
  type: ChartType.LINE,
  title: 't',
  elements: [],
  x_ticks: [],
  y_ticks: [],
  x_tick_labels: [],
  y_tick_labels: [],
  x_scale: 'linear',
  y_scale: 'log',
}

test('deserializeChart maps an unrecognized scale to ScaleType.UNKNOWN', () => {
  const chart = deserializeChart({
    ...pointChart,
    x_scale: 'not-a-scale',
  })

  expect(chart.x_scale).toBe(ScaleType.UNKNOWN)
  expect(chart.y_scale).toBe(ScaleType.LOG)
})

test('deserializeChart keeps a valid scale', () => {
  const chart = deserializeChart(pointChart)

  expect(chart.x_scale).toBe(ScaleType.LINEAR)
  expect(chart.y_scale).toBe(ScaleType.LOG)
})

test('deserializeChart maps unrecognized scatter scales', () => {
  const chart = deserializeChart({
    ...pointChart,
    type: ChartType.SCATTER,
    y_scale: 'nope',
  })

  expect(chart.x_scale).toBe(ScaleType.LINEAR)
  expect(chart.y_scale).toBe(ScaleType.UNKNOWN)
})

test('Result maps unrecognized scales through deserializeChart', () => {
  const result = new Result(
    {
      chart: {
        ...pointChart,
        x_scale: 'not-a-scale',
      },
    },
    true
  )

  expect(result.chart?.x_scale).toBe(ScaleType.UNKNOWN)
  expect(result.chart?.y_scale).toBe(ScaleType.LOG)
})

test('Result maps unrecognized scales on SuperChart children', () => {
  const result = new Result(
    {
      chart: {
        type: ChartType.SUPERCHART,
        title: 't',
        elements: [
          {
            ...pointChart,
            x_scale: 'not-a-scale',
          },
        ],
      },
    },
    true
  )

  expect(result.chart?.type).toBe(ChartType.SUPERCHART)
  expect(result.chart?.elements[0]).toMatchObject({
    x_scale: ScaleType.UNKNOWN,
  })
})
