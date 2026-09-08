import { expect, test } from 'vitest'

import { ChartType, deserializeChart, ScaleType } from '../../src/charts'

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
