// Renders tables in the style of kubectl (k8s.io/cli-runtime/pkg/printers):
// uppercase headers, left-aligned columns separated by spaces, no borders.
// https://github.com/kubernetes/cli-runtime/blob/master/pkg/printers/tableprinter.go

const COLUMN_PADDING = 3

export interface Column<T> {
  header: string
  value: (item: T) => string | null | undefined
}

/**
 * Renders `items` as a borderless, space-aligned table on stdout: a header
 * line of uppercased column headers followed by one line per item.
 *
 * @param items rows to render, in the order they should be printed.
 * @param columns column definitions; each one extracts a single cell from an item.
 *
 * @example
 * ```ts
 * renderTable(sandboxes, [
 *   { header: 'Sandbox ID', value: (sandbox) => sandbox.sandboxId },
 *   { header: 'State', value: (sandbox) => sandbox.state },
 * ])
 * ```
 */
export function renderTable<T>(items: T[], columns: Column<T>[]) {
  const headers = columns.map((column) => column.header.toUpperCase())
  const rows = items.map((item) =>
    columns.map((column) => column.value(item) ?? '')
  )

  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => row[i].length))
  )

  for (const line of [headers, ...rows]) {
    console.log(
      line
        .map((cell, i) =>
          i === line.length - 1 ? cell : cell.padEnd(widths[i] + COLUMN_PADDING)
        )
        .join('')
        .trimEnd()
    )
  }
}
