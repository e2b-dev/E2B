export { APIClient, withAPIKey, withAccessToken } from './api'
export type { components, paths } from './api'

export { ConnectionConfig } from './connectionConfig'
export type { ConnectionOpts } from './connectionConfig'

export { AuthenticationError, SandboxError } from './sandbox/errors'

export type { FilesystemEvent, EntryInfo, WatchHandle } from './sandbox/filesystem'
export {
  EventType,
  FileType,
} from './envd/filesystem/v1/filesystem_pb'

export type { ProcessHandle, ProcessResult, ProcessConfig } from './sandbox/process'

import { Sandbox } from './sandbox'

export { Sandbox }
export default Sandbox
