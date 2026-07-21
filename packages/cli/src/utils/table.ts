type TableAlignment = 'left' | 'right'

export type TableColumn<Row> = {
  name: string
  title: string
  alignment?: TableAlignment
  maxLen?: number
  getValue?: (row: Row) => unknown
}

export function printTable<Row>(columns: TableColumn<Row>[], rows: Row[]) {
  const output = formatTable(columns, rows)
  if (output) {
    console.log(output)
  }
}

export function formatTable<Row>(
  columns: TableColumn<Row>[],
  rows: Row[]
): string {
  const cells = rows.map((row) =>
    columns.map((column) =>
      formatCell(getCellValue(row, column), column.maxLen)
    )
  )
  const headers = columns.map((column) => column.title.toUpperCase())
  const widths = columns.map((_, columnIndex) =>
    Math.max(
      headers[columnIndex].length,
      ...cells.map((row) => row[columnIndex].length)
    )
  )

  return [
    formatRow(headers, columns, widths),
    ...cells.map((row) => formatRow(row, columns, widths)),
  ].join('\n')
}

function getCellValue<Row>(row: Row, column: TableColumn<Row>): unknown {
  if (column.getValue) {
    return column.getValue(row)
  }

  return (row as Record<string, unknown>)[column.name]
}

function formatCell(value: unknown, maxLen?: number): string {
  if (value === undefined || value === null) {
    return ''
  }

  const stringValue = String(value)
  if (!maxLen || stringValue.length <= maxLen) {
    return stringValue
  }

  if (maxLen <= 3) {
    return stringValue.slice(0, maxLen)
  }

  return `${stringValue.slice(0, maxLen - 3)}...`
}

function formatRow<Row>(
  values: string[],
  columns: TableColumn<Row>[],
  widths: number[]
): string {
  return values
    .map((value, index) => {
      if (columns[index].alignment === 'right') {
        return value.padStart(widths[index])
      }

      return value.padEnd(widths[index])
    })
    .join('  ')
    .trimEnd()
}
