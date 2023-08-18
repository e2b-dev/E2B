import { log_files } from 'db/prisma'
import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'

export interface FileUpload extends Pick<log_files, 'content' | 'filename' | 'relativePath' | 'last_modified'> { }

export interface PostLogUpload {
  logFiles: FileUpload[]
  projectID: string
}

export interface PostLogUploadResponse {
  id: string
}

async function handlePostLogUpload(url: string, { arg }: { arg: PostLogUpload }) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as PostLogUploadResponse
}

export function useUploadLogUpload(projectID: string) {
  const {
    trigger: upload,
  } = useSWRMutation('/api/log_upload', handlePostLogUpload)

  return useCallback(async (logFiles: FileUpload[]) =>
    upload({
      logFiles,
      projectID,
    }), [projectID, upload])
}