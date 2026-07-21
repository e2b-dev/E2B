import { describe, expect, test } from 'vitest'

import { formatTable, type TableColumn } from 'src/utils/table'

type Row = {
  name: string
  age: number
  note?: string
}

describe('formatTable', () => {
  test('prints kubectl-style columns', () => {
    const columns: TableColumn<Row>[] = [
      { name: 'name', title: 'Name' },
      { name: 'age', title: 'Age', alignment: 'right' },
      { name: 'note', title: 'Note', maxLen: 8 },
    ]

    expect(
      formatTable(columns, [
        { name: 'alpha', age: 3, note: 'short' },
        { name: 'beta', age: 120, note: 'longer-than-limit' },
      ])
    ).toBe(
      [
        'NAME   AGE  NOTE',
        'alpha    3  short',
        'beta   120  longe...',
      ].join('\n')
    )
  })

  test('supports derived values', () => {
    expect(
      formatTable<Row>(
        [
          { name: 'name', title: 'Name' },
          {
            name: 'note',
            title: 'Upper Note',
            getValue: (row) => row.note?.toUpperCase(),
          },
        ],
        [{ name: 'alpha', age: 3, note: 'ready' }]
      )
    ).toBe(['NAME   UPPER NOTE', 'alpha  READY'].join('\n'))
  })
})
