import { expect, test } from 'vitest'

import { Execution, parseOutput } from '../src/messaging'

// `Result.formats()` mirrors Python `e2b_code_interpreter/models.py`
// `Result.formats()`, which lists every available representation: text, the
// MIME types, data, chart, and any extra keys (in that order). The JS impl
// previously omitted `text` and `chart`, so a result carrying either reported
// no formats at all — diverging from Python and breaking discovery via
// `formats()`.

function resultFrom(message: object) {
  const execution = new Execution()
  parseOutput(
    execution,
    JSON.stringify({ type: 'result', is_main_result: true, ...message })
  )
  return execution.results[0]
}

test('lists text when the result has a text representation', () => {
  expect(resultFrom({ text: 'hello' }).formats()).toContain('text')
})

test('lists chart when the result has chart data', () => {
  const result = resultFrom({
    chart: {
      type: 'bar',
      title: 'T',
      elements: [],
      x_scale: { type: 'linear' },
      y_scale: { type: 'linear' },
    },
  })

  expect(result.formats()).toContain('chart')
})

test('lists both text and chart in the Python order', () => {
  const formats = resultFrom({
    text: 'hello',
    chart: {
      type: 'bar',
      title: 'T',
      elements: [],
      x_scale: { type: 'linear' },
      y_scale: { type: 'linear' },
    },
  }).formats()

  expect(formats).toEqual(['text', 'chart'])
})

test('lists every format in the same order as the Python SDK', () => {
  const formats = resultFrom({
    text: 't',
    html: 'h',
    markdown: 'm',
    svg: 's',
    png: 'p',
    jpeg: 'j',
    pdf: 'd',
    latex: 'l',
    json: '{}',
    javascript: 'js',
    data: { columns: ['a'], rows: [[1]] },
    chart: { type: 'bar', title: 'T', elements: [] },
    custom: 'extra-value',
  }).formats()

  // text, the MIME types, data, chart, then extra keys — matching Python.
  expect(formats).toEqual([
    'text',
    'html',
    'markdown',
    'svg',
    'png',
    'jpeg',
    'pdf',
    'latex',
    'json',
    'javascript',
    'data',
    'chart',
    'custom',
  ])
})

test('returns no formats for a bare result', () => {
  expect(resultFrom({}).formats()).toEqual([])
})
