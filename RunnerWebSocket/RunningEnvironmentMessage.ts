import { CodeCell } from '../CodeCell'
import { TemplateConfig } from '../TemplateConfig'

import {
  TRunningEnvironment,
  BaseMessage,
} from './BaseMessage'

export interface BaseRunningEnvironment extends BaseMessage {
  type: TRunningEnvironment.Start
  | TRunningEnvironment.StartAck
  | TRunningEnvironment.Eval
  | TRunningEnvironment.FSEventCreate
  | TRunningEnvironment.FSEventRemove
  | TRunningEnvironment.FSEventWrite
  | TRunningEnvironment.CreateDir
  | TRunningEnvironment.WriteFile
  | TRunningEnvironment.RemoveFile
  | TRunningEnvironment.ListDir
  | TRunningEnvironment.DirContent
  | TRunningEnvironment.FileContent
  | TRunningEnvironment.GetFile
  | TRunningEnvironment.Stdout
  | TRunningEnvironment.Stderr
  | TRunningEnvironment.ExecCmd
  | TRunningEnvironment.KillCmd
  | TRunningEnvironment.ListRunningCmds
  | TRunningEnvironment.CmdOut
  | TRunningEnvironment.CmdExit
  | TRunningEnvironment.RunningCmds
  | TRunningEnvironment.RunCode
  payload: {
    environmentID: string
  }
}

/**
 * Environment that a remote Runner should start. If an environment with the
 * specified `environmentID` is already running no new environment will be started.
 */
export interface RunningEnvironment_Start extends BaseRunningEnvironment {
  type: TRunningEnvironment.Start
  payload: {
    /**
     * ID of the new environment. Specified by client so it can have
     * the same ID as `DocumentEnvironment` specified in the document.
     */
    environmentID: string
    /**
     * Either the `template` or the `templateID` field must be present.
     */
    template?: TemplateConfig
    /**
     * Either the `template` or the `templateID` field must be present.
     */
    templateID?: string
  }
}

/**
 * Sent from remote Runner when a new environment has successfully started.
 */
export interface RunningEnvironment_StartAck extends BaseRunningEnvironment {
  type: TRunningEnvironment.StartAck
  payload: {
    environmentID: string
    template: Pick<TemplateConfig, 'id' | 'image'>
    /**
     * A boolean indicating whether the environment has already existed or a new one was created.
     */
    didExist: boolean
  }
}

/**
 * Code cells that remote Runner should evaluate.
 */
export interface RunningEnvironment_Eval extends BaseRunningEnvironment {
  type: TRunningEnvironment.Eval
  payload: {
    environmentID: string
    codeCells: CodeCell[]
  }
}

/**
 * Sent from remote Runner when a new file or directory has been created in environment's filesystem.
 */
export interface RunningEnvironment_FSEventCreate extends BaseRunningEnvironment {
  type: TRunningEnvironment.FSEventCreate
  payload: {
    environmentID: string
    path: string
    type: 'File' | 'Directory'
  }
}

/**
 * Sent from remote Runner when a file or directory has been removed in environment's filesystem.
 */
export interface RunningEnvironment_FSEventRemove extends BaseRunningEnvironment {
  type: TRunningEnvironment.FSEventRemove
  payload: {
    environmentID: string
    path: string
    type: 'File' | 'Directory'
  }
}

/**
 * Sent from remote Runner when a file's content in environment's filesystem has been changed.
 */
export interface RunningEnvironment_FSEventWrite extends BaseRunningEnvironment {
  type: TRunningEnvironment.FSEventWrite
  payload: {
    environmentID: string
    path: string
  }
}

/**
 * Sent to remote Runner when a client requests to create a directory in the environment's filesystem.
 */
export interface RunningEnvironment_CreateDir extends BaseRunningEnvironment {
  type: TRunningEnvironment.CreateDir
  payload: {
    environmentID: string
    /**
     * Path is relative to running environment's root dir.
     * Path contains a name of the new dir, e.g. "/src/pages"
     * will create a new directory named "pages" inside
     * the "<root_dir>/src", if the dir exists.
     */
    path: string
  }
}

/**
 * Sent to remote Runner when a client requests to overwrite content of a file in the environment's filesystem.
 */
export interface RunningEnvironment_WriteFile extends BaseRunningEnvironment {
  type: TRunningEnvironment.WriteFile
  payload: {
    environmentID: string
    /**
     * Path is relative to running environment's root dir.
     * Path contains a name of the new file, e.g. "/src/css/global.css"
     * will create a new file with name "global.css" inside
     * "<root_dir>/src/css", if the dir exists.
     */
    path: string
    content: string
  }
}


/**
 * Sent to remote Runner when a client requests to remove a file from the environment's filesystem.
 */
export interface RunningEnvironment_RemoveFile extends BaseRunningEnvironment {
  type: TRunningEnvironment.RemoveFile
  payload: {
    environmentID: string
    path: string
  }
}

/**
 * Received from remote Runner. It contains a content of a file.
 */
export interface RunningEnvironment_FileContent extends BaseRunningEnvironment {
  type: TRunningEnvironment.FileContent
  payload: {
    environmentID: string
    path: string
    content: string
  }
}

/**
 * Sent to remote Runner when a client requests the content of a file in the environment's filesystem.
 */
export interface RunningEnvironment_GetFile extends BaseRunningEnvironment {
  type: TRunningEnvironment.GetFile
  payload: {
    environmentID: string
    path: string
  }
}

/**
 * Sent to remote Runner when a client requests to list content of a directory in the environment's filesystem.
 */
export interface RunningEnvironment_ListDir extends BaseRunningEnvironment {
  type: TRunningEnvironment.ListDir
  payload: {
    environmentID: string
    path: string
  }
}

/**
 * Received from remote Runner. It contains a content of a directory.
 */
export interface RunningEnvironment_DirContent extends BaseRunningEnvironment {
  type: TRunningEnvironment.DirContent
  payload: {
    environmentID: string
    dirPath: string
    content: {
      /**
       * Full path.
       */
      path: string
      type: 'File' | 'Directory'
    }[]
  }
}

/**
 * Received from remote Runner when an environments prints to stdout.
 */
export interface RunningEnvironment_Stdout extends BaseRunningEnvironment {
  type: TRunningEnvironment.Stdout
  payload: {
    environmentID: string
    message: string
  }
}

/**
 * Received from remote Runner when an environments prints to stderr.
 */
export interface RunningEnvironment_Stderr extends BaseRunningEnvironment {
  type: TRunningEnvironment.Stderr
  payload: {
    environmentID: string
    message: string
  }
}

/**
 * Sent to remote Runner when a client requests to execute a command in the environment.
 */
export interface RunningEnvironment_ExecCmd extends BaseRunningEnvironment {
  type: TRunningEnvironment.ExecCmd
  payload: {
    environmentID: string
    /**
     * A unique ID that is used when Runner sends back the result of the command
     * via the `RunningEnvironment_CmdOut` message.
     */
    executionID: string
    command: string
  }
}

/**
 * Sent to remote Runner when a client requests to kill a command in the environment.
 */
export interface RunningEnvironment_KillCmd extends BaseRunningEnvironment {
  type: TRunningEnvironment.KillCmd
  payload: {
    environmentID: string
    /**
     * A unique ID that Runner received via the `RunningEnvironment_ExecCmd` message.
     */
    executionID: string
  }
}

/**
 * Sent to remote Runner when a client requests to list all running commands in the environment.
 */
export interface RunningEnvironment_ListRunningCmds extends BaseRunningEnvironment {
  type: TRunningEnvironment.ListRunningCmds
  payload: {
    environmentID: string
  }
}

/**
 * Received from remote Runner when a command prints to stdout or stderr.
 */
export interface RunningEnvironment_CmdOut extends BaseRunningEnvironment {
  type: TRunningEnvironment.CmdOut
  payload: {
    environmentID: string
    /**
     * A unique ID that Runner received via the `RunningEnvironment_ExecCmd` message.
     */
    executionID: string
    stdout?: string
    stderr?: string
  }
}

/**
 * Received from remote Runner when a command exits.
 */
export interface RunningEnvironment_CmdExit extends BaseRunningEnvironment {
  type: TRunningEnvironment.CmdExit
  payload: {
    environmentID: string
    /**
     * A unique ID that Runner received via the `RunningEnvironment_ExecCmd` message.
     */
    executionID: string
    error?: string
  }
}

/**
 * Received from remote Runner. It contains an array of all currently running commands at the specified date.
 */
export interface RunningEnvironment_RunningCmds extends BaseRunningEnvironment {
  type: TRunningEnvironment.RunningCmds
  payload: {
    environmentID: string
    /**
     * Unix timestamp in milliseconds denoting the date Runner checked all running commands and responded.
     */
    tookAt: number
    commands: {
      /**
       * A unique ID that Runner received via the `RunningEnvironment_ExecCmd` message.
       */
      executionID: string
      /**
       * Unix timestamp in milliseconds.
       */
      startedAt: number
    }[]
  }
}

/**
 * Sent to remote runner Runner to run a single command.
 * Usually like so: `node index.js`.
 */
export interface RunningEnvironment_RunCode extends BaseRunningEnvironment {
  type: TRunningEnvironment.RunCode
  payload: {
    environmentID: string
    /**
     * A unique ID that Runner received via the `RunningEnvironment_ExecCmd` message.
     */
    executionID: string
    code: string
    filename: string
    command: string
  }
}
