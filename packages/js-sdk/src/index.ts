export { default as api, withAPIKey, withAccessToken } from './api'
export type { ClientType, components, paths } from './api'

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

export { Process, ProcessMessage, ProcessOutput } from './sandbox/process'
export type { ProcessManager } from './sandbox/process'
export type { EnvVars } from './sandbox/envVars'
export { runCode, CodeRuntime } from './runCode' // Export CodeRuntime enum as value, not as type, so it can be actually used in consumer code
import { Sandbox } from './sandbox/index'

import { DataAnalysis } from './templates/dataAnalysis'
export { DataAnalysis as CodeInterpreter }

export { Artifact, DataAnalysis } from './templates/dataAnalysis'
export type { RunPythonOpts } from './templates/dataAnalysis'
export type { SandboxMetadata, RunningSandbox } from './sandbox/sandboxConnection'
export type { Action } from './sandbox/index'

export { Sandbox }
export default Sandbox
