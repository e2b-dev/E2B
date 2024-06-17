export {
  ApiClient,
  AuthenticationError,
} from './api'
export type { components, paths } from './api'

export { ConnectionConfig, SandboxError, DOMAIN, InvalidUserError } from './connectionConfig'
export type { ConnectionOpts, Username } from './connectionConfig'

export type { FilesystemEvent, WatchHandle, FilesystemEventType, } from './sandbox/filesystem/watchHandle'
export type {
  EntryInfo,
} from './sandbox/filesystem'
export {
  NotEnoughDiskSpaceError,
  NotFoundError as FileNotFoundError,
  FilesystemError,
  InvalidPathError,
  FileType,
} from './sandbox/filesystem'

export { ProcessError, ProcessExitError } from './sandbox/process/processHandle'
export type {
  ProcessResult,
  Stdout,
  Stderr,
  Pty,
  ProcessHandle,
} from './sandbox/process/processHandle'

export type {
  ProcessInfo,
  ProcessRequestOpts,
  ProcessConnectOpts,
  ProcessStartOpts,
} from './sandbox/process'

import { Sandbox } from './sandbox'
export { Sandbox, }
export default Sandbox
