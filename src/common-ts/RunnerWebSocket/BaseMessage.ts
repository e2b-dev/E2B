export enum TRunner {
  Error = 'Runner.Error',
}

export enum TRunningEnvironment {
  // Sent to remote Runner.
  Start = 'RunningEnvironment.Start',
  // Received from remote Runner.
  StartAck = 'RunningEnvironment.StartAck',

  // Sent to remote Runner.
  Eval = 'RunningEnvironment.Eval',

  // Received from remote Runner.
  FSEventCreate = 'RunningEnvironment.FSEventCreate',
  FSEventRemove = 'RunningEnvironment.FSEventRemove',
  FSEventWrite = 'RunningEnvironment.FSEventWrite',

  // Sent to remote Runner.
  CreateDir = 'RunningEnvironment.CreateDir',
  ListDir = 'RunningEnvironment.ListDir',
  WriteFile = 'RunningEnvironment.WriteFile',
  GetFile = 'RunningEnvironment.GetFile',
  RemoveFile = 'RunningEnvironment.RemoveFile',
  // Received from remote Runner.
  DirContent = 'RunningEnvironment.DirContent',
  FileContent = 'RunningEnvironment.FileContent',

  // Received from remote Runner.
  Stdout = 'RunningEnvironment.Stdout',
  Stderr = 'RunningEnvironment.Stderr',

  // Sent to remote Runner.
  ExecCmd = 'RunningEnvironment.ExecCmd',
  KillCmd = 'RunningEnvironment.KillCmd',
  ListRunningCmds = 'RunningEnvironment.ListRunningCmds',
  // Received from remote Runner.
  CmdOut = 'RunningEnvironment.CmdOut',
  CmdExit = 'RunningEnvironment.CmdExit',
  RunningCmds = 'RunningEnvironment.RunningCmds',

  // Sent to remove Runner and received from remote Runner
  TermData = 'RunningEnvironment.TermData',
  // Sent to remote Runner
  TermResize = 'RunningEnvironment.TermResize',

  // Sent to remote Runner.
  RunCode = 'RunningEnvironment.Run',
}

export enum TCodeCell {
  // We don't treat code cell errors as regular `RunnerErrorMessage`
  // because we usually want user to react to code cell errors in a
  // special. It may often even be desirable to show users errors as
  // they are writing their code cells. That's why we want to treat
  // code cell related errors as any other `BaseMessage` type.
  Error = 'CodeCell.Error',
}

export const MessageType = {
  Runner: TRunner,
  RunningEnvironment: TRunningEnvironment,
  CodeCell: TCodeCell,
}

/**
 * The base message communication format between server-side and client-side Runner.
 */
export interface BaseMessage {
  type: TRunner | TRunningEnvironment | TCodeCell
  payload: any
}
