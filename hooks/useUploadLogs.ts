import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'

import { RawFileLog } from 'utils/agentLogs'

export interface PostLogs {
  logFiles: RawFileLog[]
  projectID: string
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

export function useUploadLog(projectID: string) {
  const {
    trigger: upload,
  } = useSWRMutation('/api/logs', handlePostLogs)

  const uploadLog = useCallback(async (logFile: RawFileLog) =>
    upload({
      logFiles: [logFile],
      projectID,
    }), [projectID, upload])

  return uploadLog
}
