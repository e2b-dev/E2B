export { ApiClient } from './api'
export type { components, paths } from './api'

export { ConnectionConfig } from './connectionConfig'
export type {
  ConnectionConfigOpts,
  ConnectionOpts,
  Username,
} from './connectionConfig'
export {
  AuthenticationError,
  FileNotFoundError,
  GitAuthError,
  GitUpstreamError,
  InvalidArgumentError,
  NotEnoughSpaceError,
  NotFoundError,
  SandboxError,
  SandboxNotFoundError,
  TemplateError,
  TimeoutError,
  RateLimitError,
  BuildError,
  FileUploadError,
  VolumeError,
  VolumeNotFoundError,
  VolumePathNotFoundError,
  SecretError,
  SecretNotFoundError,
} from './errors'
export type { Logger } from './logs'

export { getSignature } from './sandbox/signature'

export { FileType } from './sandbox/filesystem'
export type {
  WriteInfo,
  EntryInfo,
  Filesystem,
  FilesystemWriteOpts,
  FilesystemReadOpts,
} from './sandbox/filesystem'
export { FilesystemEventType } from './sandbox/filesystem/watchHandle'
export type {
  FilesystemEvent,
  WatchHandle,
} from './sandbox/filesystem/watchHandle'

export { CommandExitError } from './sandbox/commands/commandHandle'
export type {
  CommandResult,
  Stdout,
  Stderr,
  PtyOutput,
  CommandHandle,
} from './sandbox/commands/commandHandle'
export type {
  SandboxInfo,
  SandboxMetrics,
  SandboxOpts,
  SandboxApiOpts,
  SandboxConnectOpts,
  SandboxForkOpts,
  SandboxMetricsOpts,
  SandboxPauseOpts,
  SandboxState,
  SandboxListOpts,
  SandboxPaginator,
  SandboxIamOpts,
  SandboxIamToken,
  SandboxIamTokenType,
  SandboxEgressProxyOpts,
  SandboxEgressProxyInfo,
  SandboxNetworkOpts,
  SandboxNetworkInfo,
  SandboxNetworkSelector,
  SandboxNetworkSelectorContext,
  SandboxNetworkRule,
  SandboxNetworkRuleInfo,
  SandboxNetworkRules,
  SandboxNetworkTransform,
  SandboxNetworkTransformContext,
  SandboxNetworkTransformResolver,
  SandboxNetworkUpdate,
  SandboxOnTimeout,
  SandboxLifecycle,
  SandboxInfoLifecycle,
  SnapshotInfo,
  SnapshotListOpts,
  SnapshotPaginator,
  CreateSnapshotOpts,
} from './sandbox/sandboxApi'

export type { McpServer } from './sandbox/mcp'

export { Secret, SecretPaginator } from './secret'
export type {
  SecretInfo,
  SecretCreateOpts,
  SecretUpdateOpts,
  SecretGetInfoOpts,
  SecretExistsOpts,
  SecretDestroyOpts,
  SecretListOpts,
} from './secret'

export { ALL_TRAFFIC } from './sandbox/network'

export type {
  ProcessInfo,
  CommandRequestOpts,
  CommandConnectOpts,
  CommandStartOpts,
  Commands,
  Pty,
} from './sandbox/commands'

export { Git } from './sandbox/git'
export type {
  GitRequestOpts,
  GitCloneOpts,
  GitInitOpts,
  GitRemoteAddOpts,
  GitCommitOpts,
  GitAddOpts,
  GitResetMode,
  GitResetOpts,
  GitRestoreOpts,
  GitDeleteBranchOpts,
  GitPushOpts,
  GitPullOpts,
  GitDangerouslyAuthenticateOpts,
  GitConfigOpts,
  GitConfigScope,
  GitBranches,
  GitFileStatus,
  GitStatus,
  GitStatusLabel,
} from './sandbox/git'

export { Volume, VolumeFileType } from './volume'
export type {
  VolumeInfo,
  VolumeAndToken,
  VolumeEntryStat,
  VolumeMetadataOpts,
  VolumeReadOpts,
  VolumeWriteOpts,
  VolumeApiOpts,
  VolumeConnectionConfig,
  // Deprecated aliases, kept for backwards compatibility.
  VolumeMetadataOptions,
  VolumeWriteOptions,
} from './volume'

export { Sandbox }
import { Sandbox } from './sandbox'

export default Sandbox

export * from './template'

export {
  ReadyCmd,
  waitForPort,
  waitForURL,
  waitForProcess,
  waitForFile,
  waitForTimeout,
} from './template/readycmd'

export {
  LogEntry,
  LogEntryStart,
  LogEntryEnd,
  type LogEntryLevel,
  defaultBuildLogger,
} from './template/logger'
