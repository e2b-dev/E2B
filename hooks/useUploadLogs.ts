import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'

import { PostLogs, PostLogsResponse, RawFileLog } from 'utils/agentLogs'

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

  const uploadLog = useCallback(async (logFile: RawFileLog) => {
    await upload({
      logFiles: [logFile],
      projectID,
    })
  }, [projectID, upload])

  return uploadLog
}
