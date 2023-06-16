import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'

import { LogsMetadata, RawFileLog } from 'utils/agentLogs'

export interface PostLogs {
  logFiles: RawFileLog[]
  projectID: string
  metadata: LogsMetadata
}

export interface PostLogsResponse {
  id: string
}

async function handlePostLogs(url: string, { arg }: { arg: PostLogs }) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as PostLogsResponse
}

export function useUploadLogs(projectID: string) {
  const {
    trigger: upload,
  } = useSWRMutation('/api/logs', handlePostLogs)

  return useCallback(async (logFiles: RawFileLog[], metadata: LogsMetadata) =>
    upload({
      logFiles,
      projectID,
      metadata,
    }), [projectID, upload])
} 