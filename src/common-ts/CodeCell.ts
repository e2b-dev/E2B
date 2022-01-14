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
//export interface CodeCell {
//  id: string
//  name: string
//  code: string
//  runningEnvID: string
//  templateID: string
//  //state: CodeCellSymbol[]
//}
