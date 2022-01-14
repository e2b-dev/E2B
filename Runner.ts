import {
  CodeCell,
  CodeCellSymbol,
} from './CodeCell'
import { TemplateConfig } from './TemplateConfig'


export interface RunnerJob {
  assignedAt: Date
  template: TemplateConfig
  cells: CodeCell[]
}

/**
 * WebSocket message types sent from the Runner service back to a client (browser).
 */
export enum RunnerMsgType {
  SymbolValue = 'SymbolValue',
  Stdout = 'Stdout',
  Stderr = 'Stderr',
}

/**
 * A message sent from the Runner service to a client if symbol's value changes in a code cell.
 */
export interface RunnerSymbolValueMsg {
  type: RunnerMsgType.SymbolValue
  cellName: string
  templateID: string
  symbol: CodeCellSymbol
}

/**
 * A message sent from the Runner service back to a client that echoes code cells' *stdout* channel.
 */
export interface RunnerStdoutMsg {
  type: RunnerMsgType.Stdout
  cellName: string
  templateID: string
  message: any[]
}

/**
 * A message sent from the Runner service back to a client that echoes code cells' *stderr* channel.
 */
export interface RunnerStderrMsg {
  type: RunnerMsgType.Stderr
  cellName: string
  templateID: string
  message: any[]
}
