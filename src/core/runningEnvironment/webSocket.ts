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


/**
 * Request to write a content to a file in the environment's filesystem.
 */
function writeFile(
  conn: WebSocketConnection, {
    environmentID,
    path,
    content,
  }: {
    environmentID: string,
    path: string,
    content: string,
  },
) {
  const msg: rws.RunningEnvironment_WriteFile = {
    type: rws.MessageType.RunningEnvironment.WriteFile,
    payload: {
      environmentID,
      path,
      content,
    },
  }
  conn.send(msg)
}

/**
 * Request to delete a file from the environment's filesystem.
 */
function deleteFile(
  conn: WebSocketConnection, {
    environmentID,
    path,
  }: {
    environmentID: string,
    path: string,
  },
) {
  const msg: rws.RunningEnvironment_RemoveFile = {
    type: rws.MessageType.RunningEnvironment.RemoveFile,
    payload: {
      environmentID,
      path,
    },
  }
  conn.send(msg)
}

export {
  start,
  execCmd,
  writeFile,
  deleteFile,
}
