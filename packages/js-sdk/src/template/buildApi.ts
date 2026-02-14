import { ApiClient, handleApiError, paths } from '../api'
import { stripAnsi } from '../utils'
import { BuildError, FileUploadError, TemplateError } from '../errors'
import { LogEntry } from './logger'
import { getBuildStepIndex, tarFileStreamUpload } from './utils'
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

type ApiBuildStatusResponse =
  paths['/templates/{templateID}/builds/{buildID}/status']['get']['responses']['200']['content']['application/json']

export type TriggerBuildTemplate =
  paths['/v2/templates/{templateID}/builds/{buildID}']['post']['requestBody']['content']['application/json']

export async function requestBuild(
  client: ApiClient,
  { name, tags, cpuCount, memoryMB }: RequestBuildInput
) {
  const requestBuildRes = await client.api.POST('/v3/templates', {
    body: {
      name,
      tags,
      cpuCount,
      memoryMB,
    },
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
  stackTrace?: string
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
  stackTrace: string | undefined
) {
  const { fileName, url, fileContextPath, ignorePatterns, resolveSymlinks } =
    options
  try {
    const uploadStream = await tarFileStreamUpload(
      fileName,
      fileContextPath,
      ignorePatterns,
      resolveSymlinks
    )

    // The compiler assumes this is Web fetch API, but it's actually Node.js fetch API
    const res = await fetch(url, {
      method: 'PUT',
      // @ts-expect-error
      body: uploadStream,
      duplex: 'half',
    })

    if (!res.ok) {
      throw new FileUploadError(
        `Failed to upload file: ${res.statusText}`,
        stackTrace
      )
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
  { templateID, buildID, template }: TriggerBuildInput
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
  { templateID, buildID, logsOffset }: GetBuildStatusInput
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
  { alias }: CheckAliasExistsInput
): Promise<boolean> {
  const aliasRes = await client.api.GET('/templates/aliases/{alias}', {
    params: {
      path: {
        alias,
      },
    },
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
  }: {
    templateID: string
    buildID: string
    onBuildLogs?: (logEntry: LogEntry) => void
    logsRefreshFrequency: number
    stackTraces: (string | undefined)[]
  }
): Promise<void> {
  let logsOffset = 0
  let status: TemplateBuildStatus = 'building'

  while (status === 'building' || status === 'waiting') {
    const buildStatus = await getBuildStatus(client, {
      templateID,
      buildID,
      logsOffset,
    })

    logsOffset += buildStatus.logEntries.length

    buildStatus.logEntries.forEach((logEntry) =>
      onBuildLogs?.(
        new LogEntry(
          logEntry.timestamp,
          logEntry.level,
          stripAnsi(logEntry.message)
        )
      )
    )

    status = buildStatus.status
    switch (status) {
      case 'ready': {
        return
      }
      case 'waiting': {
        break
      }
      case 'error': {
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
    }

    // Wait for a short period before checking the status again
    await new Promise((resolve) => setTimeout(resolve, logsRefreshFrequency))
  }

  throw new BuildError('Unknown build error occurred.')
}

export async function assignTags(
  client: ApiClient,
  { targetName, tags }: { targetName: string; tags: string[] }
): Promise<TemplateTagInfo> {
  const res = await client.api.POST('/templates/tags', {
    body: { target: targetName, tags },
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
  { name, tags }: { name: string; tags: string[] }
): Promise<void> {
  const res = await client.api.DELETE('/templates/tags', {
    body: { name, tags },
  })

  const error = handleApiError(res, TemplateError)
  if (error) {
    throw error
  }
}

export async function getTemplateTags(
  client: ApiClient,
  { templateID }: { templateID: string }
): Promise<TemplateTag[]> {
  const res = await client.api.GET('/templates/{templateID}/tags', {
    params: {
      path: {
        templateID,
      },
    },
  })

  const error = handleApiError(res, TemplateError)
  if (error) {
    throw error
  }

  if (!res.data) {
    throw new TemplateError('Failed to get template tags')
  }

  return res.data.map((item) => ({
    tag: item.tag,
    buildId: item.buildID,
    createdAt: new Date(item.createdAt),
  }))
}
