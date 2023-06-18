import { log_files } from 'db/prisma'
import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'

export interface FileUpload extends Pick<log_files, 'content' | 'filename' | 'relativePath' | 'size' | 'last_modified' | 'type'> {

}

export interface PostLogs {
  logFiles: FileUpload[]
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

export function useUploadLogs(projectID: string) {
  const {
    trigger: upload,
  } = useSWRMutation('/api/logs', handlePostLogs)

  return useCallback(async (logFiles: FileUpload[]) =>
    upload({
      logFiles,
      projectID,
    }), [projectID, upload])
} 