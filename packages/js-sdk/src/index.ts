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

export { ProcessExitError } from './sandbox/process/processHandle'
export type {
  ProcessResult,
  Stdout,
  Stderr,
  PtyOutput,
  ProcessHandle,
} from './sandbox/process/processHandle'
export type { SandboxApiOpts } from './sandbox/sandboxApi'

export type {
  ProcessInfo,
  ProcessRequestOpts,
  ProcessConnectOpts,
  ProcessStartOpts,
  Process,
  Pty,
} from './sandbox/process'

export type { SandboxInfo } from './sandbox/sandboxApi'
export type { SandboxOpts } from './sandbox'
import { Sandbox } from './sandbox'
export { Sandbox }
export default Sandbox
