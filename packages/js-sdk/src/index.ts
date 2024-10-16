export { ApiClient } from './api'
export type { components, paths } from './api'

export {
  AuthenticationError,
  SandboxError,
  TimeoutError,
  NotFoundError,
  NotEnoughSpaceError,
  InvalidArgumentError,
  TemplateError,
} from './errors'
export { ConnectionConfig } from './connectionConfig'
export type { Logger } from './logs'
export type { ConnectionOpts, Username } from './connectionConfig'

export { FilesystemEventType } from './sandbox/filesystem/watchHandle'
export type {
  FilesystemEvent,
  WatchHandle,
} from './sandbox/filesystem/watchHandle'
export type { EntryInfo, Filesystem, WatchOpts } from './sandbox/filesystem'
export { FileType } from './sandbox/filesystem'

export { CommandExitError } from './sandbox/commands/commandHandle'
export type {
  CommandResult,
  Stdout,
  Stderr,
  PtyOutput,
  CommandHandle,
} from './sandbox/commands/commandHandle'
export type { SandboxApiOpts } from './sandbox/sandboxApi'

export type {
  ProcessInfo,
  CommandRequestOpts,
  CommandConnectOpts,
  CommandStartOpts,
  Commands,
  Pty,
} from './sandbox/commands'

export type { SandboxInfo } from './sandbox/sandboxApi'
export type { SandboxOpts } from './sandbox'
import { Sandbox } from './sandbox'
export { Sandbox }
export default Sandbox
