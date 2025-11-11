import { ApiClient, handleApiError, paths } from '../api'
import { stripAnsi } from '../utils'
import { BuildError, FileUploadError } from '../errors'
import { LogEntry } from './logger'
import { getBuildStepIndex, tarFileStreamUpload } from './utils'

type RequestBuildInput = {
  alias: string
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

export type GetBuildStatusResponse =
  paths['/templates/{templateID}/builds/{buildID}/status']['get']['responses']['200']['content']['application/json']

export type TriggerBuildTemplate =
  paths['/v2/templates/{templateID}/builds/{buildID}']['post']['requestBody']['content']['application/json']

export async function requestBuild(
  client: ApiClient,
  { alias, cpuCount, memoryMB }: RequestBuildInput
) {
  const requestBuildRes = await client.api.POST('/v3/templates', {
    body: {
      alias,
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
    const { contentLength, uploadStream } = await tarFileStreamUpload(
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
      headers: {
        'Content-Length': contentLength.toString(),
      },
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

export async function getBuildStatus(
  client: ApiClient,
  { templateID, buildID, logsOffset }: GetBuildStatusInput
): Promise<GetBuildStatusResponse> {
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

  return buildStatusRes.data
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
  let status: GetBuildStatusResponse['status'] = 'building'

  while (status === 'building' || status === 'waiting') {
    const buildStatus = await getBuildStatus(client, {
      templateID,
      buildID,
      logsOffset,
    })

    logsOffset += buildStatus.logEntries.length

    buildStatus.logEntries.forEach(
      (logEntry: GetBuildStatusResponse['logEntries'][number]) =>
        onBuildLogs?.(
          new LogEntry(
            new Date(logEntry.timestamp),
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

        // Collect error logs - always fetch with offset 0 when build fails
        // to ensure we get all logs including error logs from Loki
        let errorLogs: string[] = []
        const failedStep = buildStatus.reason?.step

        // First, collect logs from reason.logEntries if available
        if (
          buildStatus.reason?.logEntries &&
          buildStatus.reason.logEntries.length > 0
        ) {
          errorLogs = buildStatus.reason.logEntries.map(
            (entry) => stripAnsi(entry.message)
          )
        }

        // Always fetch logs with offset 0 to ensure we capture all error logs
        // This is important because when offset is too high, error logs might be missed
        try {
          const errorBuildStatus = await getBuildStatus(client, {
            templateID,
            buildID,
            logsOffset: 0,
          })

          // Filter logs for the failed step if step is known
          if (failedStep) {
            const stepLogs = errorBuildStatus.logEntries
              .filter((entry) => entry.step === failedStep)
              .map((entry) => stripAnsi(entry.message))

            // Merge with reason.logEntries, avoiding duplicates
            const existingMessages = new Set(errorLogs)
            stepLogs.forEach((log) => {
              if (!existingMessages.has(log)) {
                errorLogs.push(log)
                existingMessages.add(log)
              }
            })
          } else {
            // If no step info, include all error-level logs and stderr logs
            const additionalLogs = errorBuildStatus.logEntries
              .filter(
                (entry) =>
                  entry.level === 'error' ||
                  (entry.message.includes('[stderr]') ||
                    entry.message.toLowerCase().includes('error'))
              )
              .map((entry) => stripAnsi(entry.message))

            // Merge avoiding duplicates
            const existingMessages = new Set(errorLogs)
            additionalLogs.forEach((log) => {
              if (!existingMessages.has(log)) {
                errorLogs.push(log)
                existingMessages.add(log)
              }
            })
          }
        } catch (fetchError) {
          // If fetching logs fails, continue with just the error message and reason.logEntries
        }

        // Build error message with logs if available
        let errorMessage = buildStatus?.reason?.message ?? 'Unknown error'
        if (errorLogs.length > 0) {
          errorMessage += '\n\nError logs:\n' + errorLogs.join('\n')
        }

        throw new BuildError(errorMessage, stackError)
      }
    }

    // Wait for a short period before checking the status again
    await new Promise((resolve) => setTimeout(resolve, logsRefreshFrequency))
  }

  throw new BuildError('Unknown build error occurred.')
}
