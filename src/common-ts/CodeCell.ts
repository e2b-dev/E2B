export interface CodeCellSymbol {
  symbolName: string
  value: any
}

export interface CodeCell {
  id: string
  name: string
  templateID: string
  code?: string
  state: CodeCellSymbol[]
}
