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
