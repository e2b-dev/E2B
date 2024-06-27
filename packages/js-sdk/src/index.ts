export {
  ApiClient,
} from './api'
export type { components, paths } from './api'

export {
  AuthenticationError,
  SandboxError,
  InvalidPathError,
  TimeoutError,
  NotFoundError,
  NotEnoughDiskSpaceError,
  InvalidUserError,
} from './errors'
export {
  ConnectionConfig,
  DOMAIN,
} from './connectionConfig'
export type { Logger } from './logs'
export type { ConnectionOpts, Username } from './connectionConfig'

export { FilesystemEventType } from './sandbox/filesystem/watchHandle'
export type { FilesystemEvent, WatchHandle } from './sandbox/filesystem/watchHandle'
export type {
  EntryInfo,
} from './sandbox/filesystem'
export {
  FileType,
} from './sandbox/filesystem'

export { ProcessExitError } from './sandbox/process/processHandle'
export type {
  ProcessResult,
  Stdout,
  Stderr,
  Pty,
  ProcessHandle,
} from './sandbox/process/processHandle'
export type { SandboxApiOpts } from './sandbox/sandboxApi'

export type {
  ProcessInfo,
  ProcessRequestOpts,
  ProcessConnectOpts,
  ProcessStartOpts,
} from './sandbox/process'

export type { SandboxInfo } from './sandbox/sandboxApi'
import { Sandbox } from './sandbox'
export type { SandboxOpts } from './sandbox'
export { Sandbox }
export default Sandbox
