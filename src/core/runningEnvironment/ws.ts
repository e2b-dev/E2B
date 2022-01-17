import * as rws from 'src/common-ts/RunnerWebSocket'
import { TemplateConfig } from 'src/common-ts/TemplateConfig'
import { WebSocketConnection } from 'src/core/webSocketConnection'

function start(
  conn: WebSocketConnection, {
    environmentID,
    template,
  }: {
    environmentID: string,
    template: TemplateConfig,
  },
) {
  const msg: rws.RunningEnvironment_Start = {
    type: rws.MessageType.RunningEnvironment.Start,
    payload: {
      environmentID,
      template,
    },
  }
  conn.send(msg)
}

function execCmd(conn: WebSocketConnection, {
  environmentID,
  executionID,
  command,
}: {
  environmentID: string,
  executionID: string,
  command: string,
}) {
  const msg: rws.RunningEnvironment_ExecCmd = {
    type: rws.MessageType.RunningEnvironment.ExecCmd,
    payload: {
      environmentID,
      executionID,
      command,
    },
  }
  conn.send(msg)
}

export {
  start,
  execCmd,
}
