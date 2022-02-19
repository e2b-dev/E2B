import {
  TCodeCell,
  BaseMessage,
} from './BaseMessage'

export interface BaseCodeCell extends BaseMessage {
  type: TCodeCell.Error,
  payload: {
    environmentID: string
    codeCellID: string
  }
}

export interface CodeCell_Error extends BaseMessage {
  type: TCodeCell.Error
  payload: {
    environmentID: string
    codeCellID: string
    message: string
  }
}
