import { ApiClient, handleApiError, components } from '../api'
import { buildRequestSignal } from '../connectionConfig'
import { dynamicImport } from '../utils'
import { BuildError, FileUploadError, TemplateError } from '../errors'
import { FILE_UPLOAD_TIMEOUT_MS } from './consts'
import { LogEntry } from './logger'
import { getBuildStepIndex, tarFileToTempFile } from './utils'
import {
  BuildStatusReason,
  TemplateBuildStatus,
  TemplateBuildStatusResponse,
  TemplateTag,
  TemplateTagInfo,
} from './types'

type RequestBuildInput = {
  name: string
  tags?: string[]
  cpuCount: number
  memoryMB: number
}

type GetFileUploadLinkInput = {
  templateID: string
  filesHash: string
}

type TriggerBuildInput = {
  templateID: string
  buildID: string
  template: TriggerBuildTemplate
}

type GetBuildStatusInput = {
  templateID: string
  buildID: string
  logsOffset?: number
}

type CheckAliasExistsInput = {
  alias: string
}

type ApiBuildStatusResponse = components['schemas']['TemplateBuildInfo']

export type TriggerBuildTemplate = components['schemas']['TemplateBuildStartV2']

export async function requestBuild(
  client: ApiClient,
  { name, tags, cpuCount, memoryMB }: RequestBuildInput,
  signal?: AbortSignal
) {
  const requestBuildRes = await client.api.POST('/v3/templates', {
    body: {
      name,
      tags,
      cpuCount,
      memoryMB,
    },
    signal,
  })

  const error = handleApiError(requestBuildRes, BuildError)
  if (error) {
    throw error
  }

  if (!requestBuildRes.data) {
    throw new BuildError('Failed to request build')
  }

  return requestBuildRes.data
}

export async function getFileUploadLink(
  client: ApiClient,
  { templateID, filesHash }: GetFileUploadLinkInput,
  stackTrace?: string,
  signal?: AbortSignal
) {
  const fileUploadLinkRes = await client.api.GET(
    '/templates/{templateID}/files/{hash}',
    {
      params: {
        path: {
          templateID,
          hash: filesHash,
        },
      },
      signal,
    }
  )

  const error = handleApiError(fileUploadLinkRes, FileUploadError, stackTrace)
  if (error) {
    throw error
  }

  if (!fileUploadLinkRes.data) {
    throw new FileUploadError('Failed to get file upload link', stackTrace)
  }

  return fileUploadLinkRes.data
}

export async function uploadFile(
  options: {
    fileName: string
    fileContextPath: string
    url: string
    ignorePatterns: string[]
    resolveSymlinks: boolean
  },
  stackTrace: string | undefined,
  // Uploads (PUT to S3 presigned URL) can take a long time for large
  // archives — the 60s API default would break them, so we use a 1-hour
  // upload default (`FILE_UPLOAD_TIMEOUT_MS`) when `requestTimeoutMs` is
  // not supplied. Pass `requestTimeoutMs` (or an `AbortSignal.timeout(ms)`
  // via `signal`) to override.
  abortOpts?: { signal?: AbortSignal; requestTimeoutMs?: number }
) {
  const { fileName, url, fileContextPath, ignorePatterns, resolveSymlinks } =
    options
  try {
    // Spool the archive to a temporary file so it can be streamed from disk
    // instead of buffered in memory. S3 presigned PUT URLs reject
    // Transfer-Encoding: chunked with 501 NotImplemented (see
    // e2b-dev/e2b#1243), so the upload sends an explicit Content-Length,
    // which fetch honors for stream bodies. The Python SDK takes the same
    // approach (build_api.py:upload_file).
    const {
      path: tarPath,
      size,
      cleanup,
    } = await tarFileToTempFile(
      fileName,
      fileContextPath,
      ignorePatterns,
      resolveSymlinks
    )

    try {
      // Dynamically import so the browser bundle doesn't pull in node:fs
      // and node:stream.
      const { createReadStream } =
        await dynamicImport<typeof import('node:fs')>('node:fs')
      const { Readable } =
        await dynamicImport<typeof import('node:stream')>('node:stream')

      const res = await fetch(url, {
        method: 'PUT',
        body: Readable.toWeb(
          createReadStream(tarPath)
        ) as ReadableStream<Uint8Array>,
        headers: {
          'Content-Length': size.toString(),
        },
        // Streaming request bodies require half-duplex mode.
        duplex: 'half',
        signal: buildRequestSignal(
          abortOpts?.requestTimeoutMs ?? FILE_UPLOAD_TIMEOUT_MS,
          abortOpts?.signal
        ),
      } as RequestInit)

      if (!res.ok) {
        throw new FileUploadError(
          `Failed to upload file: ${res.statusText}`,
          stackTrace
        )
      }
    } finally {
      await cleanup()
    }
  } catch (error) {
    if (error instanceof FileUploadError) {
      throw error
    }
    throw new FileUploadError(`Failed to upload file: ${error}`, stackTrace)
  }
}

export async function triggerBuild(
  client: ApiClient,
  { templateID, buildID, template }: TriggerBuildInput,
  signal?: AbortSignal
) {
  const triggerBuildRes = await client.api.POST(
    '/v2/templates/{templateID}/builds/{buildID}',
    {
      params: {
        path: {
          templateID,
          buildID,
        },
      },
      body: template,
      signal,
    }
  )

  const error = handleApiError(triggerBuildRes, BuildError)
  if (error) {
    throw error
  }
}

function mapLogEntry(
  entry: ApiBuildStatusResponse['logEntries'][number]
): LogEntry {
  return new LogEntry(new Date(entry.timestamp), entry.level, entry.message)
}

function mapBuildStatusReason(
  reason: ApiBuildStatusResponse['reason']
): BuildStatusReason | undefined {
  if (!reason) {
    return undefined
  }
  return {
    message: reason.message,
    step: reason.step,
    logEntries: (reason.logEntries ?? []).map(mapLogEntry),
  }
}

export async function getBuildStatus(
  client: ApiClient,
  { templateID, buildID, logsOffset }: GetBuildStatusInput,
  signal?: AbortSignal
): Promise<TemplateBuildStatusResponse> {
  const buildStatusRes = await client.api.GET(
    '/templates/{templateID}/builds/{buildID}/status',
    {
      params: {
        path: {
          templateID,
          buildID,
        },
        query: {
          logsOffset,
        },
      },
      signal,
    }
  )

  const error = handleApiError(buildStatusRes, BuildError)
  if (error) {
    throw error
  }

  if (!buildStatusRes.data) {
    throw new BuildError('Failed to get build status')
  }

  return {
    buildID: buildStatusRes.data.buildID,
    templateID: buildStatusRes.data.templateID,
    status: buildStatusRes.data.status,
    logEntries: buildStatusRes.data.logEntries.map(mapLogEntry),
    logs: buildStatusRes.data.logs,
    reason: mapBuildStatusReason(buildStatusRes.data.reason),
  }
}

export async function checkAliasExists(
  client: ApiClient,
  { alias }: CheckAliasExistsInput,
  signal?: AbortSignal
): Promise<boolean> {
  const aliasRes = await client.api.GET('/templates/aliases/{alias}', {
    params: {
      path: {
        alias,
      },
    },
    signal,
  })

  // If we get a NotFound, the alias doesn't exist
  if (aliasRes.response.status === 404) {
    return false
  }

  // If we get a Forbidden, alias exists, but you are not owner
  if (aliasRes.response.status === 403) {
    return true
  }

  // Handle other errors
  const error = handleApiError(aliasRes, TemplateError)
  if (error) {
    throw error
  }

  // If we get Ok with data, you are owner and the alias exists
  return aliasRes.data !== undefined
}

export async function waitForBuildFinish(
  client: ApiClient,
  {
    templateID,
    buildID,
    onBuildLogs,
    logsRefreshFrequency,
    stackTraces,
    signal,
    requestTimeoutMs,
  }: {
    templateID: string
    buildID: string
    onBuildLogs?: (logEntry: LogEntry) => void
    logsRefreshFrequency: number
    stackTraces: (string | undefined)[]
    signal?: AbortSignal
    requestTimeoutMs?: number
  }
): Promise<void> {
  let logsOffset = 0
  let status: TemplateBuildStatus = 'building'

  const pollStatus = async (): Promise<TemplateBuildStatusResponse> => {
    const buildStatus = await getBuildStatus(
      client,
      {
        templateID,
        buildID,
        logsOffset,
      },
      buildRequestSignal(requestTimeoutMs, signal)
    )

    logsOffset += buildStatus.logEntries.length
    buildStatus.logEntries.forEach((logEntry) => onBuildLogs?.(logEntry))

    return buildStatus
  }

  while (status === 'building' || status === 'waiting') {
    signal?.throwIfAborted()

    const buildStatus = await pollStatus()

    status = buildStatus.status
    switch (status) {
      case 'ready':
      case 'error': {
        // The status endpoint returns at most 100 log entries per call, so
        // the terminal response may not include the last logs — keep
        // fetching until they are drained.
        let tailStatus = buildStatus
        while (tailStatus.logEntries.length > 0) {
          signal?.throwIfAborted()
          tailStatus = await pollStatus()
        }

        if (status === 'ready') {
          return
        }

        let stackError: string | undefined
        if (buildStatus.reason?.step !== undefined) {
          const step = getBuildStepIndex(
            buildStatus.reason.step,
            stackTraces.length
          )
          stackError = stackTraces[step]
        }

        throw new BuildError(
          buildStatus?.reason?.message ?? 'Unknown error',
          stackError
        )
      }
      case 'waiting': {
        break
      }
    }

    // Wait for a short period before checking the status again. Abort is
    // observed on the next iteration via `signal?.throwIfAborted()`.
    await new Promise((resolve) => setTimeout(resolve, logsRefreshFrequency))
  }

  throw new BuildError('Unknown build error occurred.')
}

export async function assignTags(
  client: ApiClient,
  { targetName, tags }: { targetName: string; tags: string[] },
  signal?: AbortSignal
): Promise<TemplateTagInfo> {
  const res = await client.api.POST('/templates/tags', {
    body: { target: targetName, tags },
    signal,
  })

  const error = handleApiError(res, TemplateError)
  if (error) {
    throw error
  }

  if (!res.data) {
    throw new TemplateError('Failed to assign tags')
  }

  return {
    buildId: res.data.buildID,
    tags: res.data.tags,
  }
}

export async function removeTags(
  client: ApiClient,
  { name, tags }: { name: string; tags: string[] },
  signal?: AbortSignal
): Promise<void> {
  const res = await client.api.DELETE('/templates/tags', {
    body: { name, tags },
    signal,
  })

  const error = handleApiError(res, TemplateError)
  if (error) {
    throw error
  }
}

export async function getTemplateTags(
  client: ApiClient,
  { templateID }: { templateID: string },
  signal?: AbortSignal
): Promise<TemplateTag[]> {
  const res = await client.api.GET('/templates/{templateID}/tags', {
    params: {
      path: {
        templateID,
      },
    },
    signal,
  })

  const error = handleApiError(res, TemplateError)
  if (error) {
    throw error
  }

  if (!res.data) {
    throw new TemplateError('Failed to get template tags')
  }

  return res.data.map((item: components['schemas']['TemplateTag']) => ({
    tag: item.tag,
    buildId: item.buildID,
    createdAt: new Date(item.createdAt),
  }))
}
