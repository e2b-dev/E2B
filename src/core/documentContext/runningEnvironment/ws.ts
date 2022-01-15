import * as rws from '../../../common-ts/RunnerWebSocket'
import { TemplateConfig } from '../../../common-ts/TemplateConfig'
import { CodeCell } from '../../../common-ts/CodeCell'
import { WebSocketConnection } from '../../webSocketConnection'

function start(
  conn: WebSocketConnection, {
    envID,
    template,
  }: {
    envID: string,
    template: TemplateConfig,
  },
) {
  const msg: rws.RunningEnvironment_Start = {
    type: rws.MessageType.RunningEnvironment.Start,
    payload: {
      environmentID: envID,
      template,
    },
  }
  conn.send(msg)
}

function evaluate(conn: WebSocketConnection, {
  envID,
  codeCells,
}: {
  envID: string,
  codeCells: CodeCell[]
},
) {
  const msg: rws.RunningEnvironment_Eval = {
    type: rws.MessageType.RunningEnvironment.Eval,
    payload: {
      environmentID: envID,
      codeCells,
    },
  }
  conn.send(msg)
}

function execCmd(conn: WebSocketConnection, {
  envID,
  execID,
  command,
}: {
  envID: string,
  execID: string,
  command: string,
}) {
  const msg: rws.RunningEnvironment_ExecCmd = {
    type: rws.MessageType.RunningEnvironment.ExecCmd,
    payload: {
      environmentID: envID,
      executionID: execID,
      command,
    },
  }
  conn.send(msg)
}

export {
  start,
  evaluate,
  execCmd,
}
