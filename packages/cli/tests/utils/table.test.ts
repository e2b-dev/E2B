import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderTable } from '../../src/utils/table'

describe('renderTable', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function capture() {
    const lines: string[] = []
    vi.spyOn(console, 'log').mockImplementation((line: string) =>
      lines.push(line)
    )
    return lines
  }

  it('prints uppercase headers and space-aligned columns', () => {
    const lines = capture()

    renderTable(
      [
        { id: 'sbx-1', name: 'alpha' },
        { id: 'sbx-longer-2', name: 'b' },
      ],
      [
        { header: 'Sandbox ID', value: (row) => row.id },
        { header: 'Name', value: (row) => row.name },
      ]
    )

    expect(lines).toEqual([
      'SANDBOX ID     NAME',
      'sbx-1          alpha',
      'sbx-longer-2   b',
    ])
  })

  it('pads columns to the widest cell and trims trailing whitespace', () => {
    const lines = capture()

    renderTable(
      [{ a: 'x', b: '' }],
      [
        { header: 'A', value: (row) => row.a },
        { header: 'B', value: (row) => row.b },
      ]
    )

    expect(lines).toEqual(['A   B', 'x'])
  })

  it('aligns columns containing wide (CJK) characters by display width', () => {
    const lines = capture()

    renderTable(
      [
        { name: '日本語', state: 'ok' },
        { name: 'abcdef', state: 'ok' },
      ],
      [
        { header: 'Name', value: (row) => row.name },
        { header: 'State', value: (row) => row.state },
      ]
    )

    expect(lines).toEqual([
      'NAME     STATE',
      '日本語   ok',
      'abcdef   ok',
    ])
  })
})
