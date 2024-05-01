export { APIClient, withAPIKey, withAccessToken } from './api'
export type { components, paths } from './api'

export { SANDBOX_DOMAIN, API_HOST } from './constants'
export type { SandboxOpts, DownloadFileFormat } from './sandbox'
export type { OpenPort } from './sandbox/codeSnippet'
export { Terminal, TerminalOutput } from './sandbox/terminal'
export type { TerminalManager } from './sandbox/terminal'
export type { FilesystemManager, FileInfo } from './sandbox/filesystem'
export {
  default as FilesystemWatcher,
  FilesystemOperation,
} from './sandbox/filesystemWatcher'
export type {
  FilesystemEvent,
  FilesystemEventListener,
} from './sandbox/filesystemWatcher'

export { AuthenticationError, CurrentWorkingDirectoryDoesntExistError, TimeoutError } from './error'
export { Process, ProcessMessage, ProcessOutput } from './sandbox/process'
export type { ProcessManager } from './sandbox/process'
export type { EnvVars } from './sandbox/envVars'
import { Sandbox } from './sandbox'

export type { SandboxMetadata, RunningSandbox } from './sandbox/sandboxConnection'

export { Sandbox }
export default Sandbox
