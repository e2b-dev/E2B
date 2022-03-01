import * as rws from '../../common-ts/RunnerWebSocket'
import { TemplateConfig } from '../../common-ts/TemplateConfig'
import { Env } from '../devbook'
import { WebSocketConnection } from '../webSocketConnection'

/**
 * Request to receive the `RunningEnvironment.DirContent` message in the future
 * containting the content of the directory at the given path.
 */
function listDir(
  conn: WebSocketConnection, {
    environmentID,
    path,
  }: {
    environmentID: string,
    path: string,
  },
) {
  const msg: rws.RunningEnvironment_ListDir = {
    type: rws.MessageType.RunningEnvironment.ListDir,
    payload: {
      environmentID,
      path,
    },
  }
  conn.send(msg)
}

/**
 * Request to create a dir in the environment's filesystem.
 */
function createDir(
  conn: WebSocketConnection, {
    environmentID,
    path,
  }: {
    environmentID: string,
    path: string,
  },
) {
  const msg: rws.RunningEnvironment_CreateDir = {
    type: rws.MessageType.RunningEnvironment.CreateDir,
    payload: {
      environmentID,
      path,
    },
  }
  conn.send(msg)
}

/**
 * Request to get a file from the environment's filesystem.
 */
function getFile(
  conn: WebSocketConnection, {
    environmentID,
    path,
  }: {
    environmentID: string,
    path: string,
  },
) {
  const msg: rws.RunningEnvironment_GetFile = {
    type: rws.MessageType.RunningEnvironment.GetFile,
    payload: {
      environmentID,
      path,
    },
  }
  conn.send(msg)
}


function start(
  conn: WebSocketConnection, {
    environmentID,
    templateID,
  }: {
    environmentID: string,
    templateID: Env,
  },
) {
  const msg: rws.RunningEnvironment_Start = {
    type: rws.MessageType.RunningEnvironment.Start,
    payload: {
      environmentID,
      templateID,
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
  getFile,
  createDir,
  listDir,
}
