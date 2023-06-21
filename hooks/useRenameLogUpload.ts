import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'

export interface PatchLogUpload {
  logUploadID: string
  displayName: string
}

export interface PatchLogUploadResponse { }

async function handlePatchLogUpload(url: string, { arg }: { arg: PatchLogUpload }) {
  const response = await fetch(url, {
    method: 'PATCH',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as PatchLogUploadResponse
}

export function useRenameLogUpload() {
  const {
    trigger: rename,
  } = useSWRMutation('/api/log_upload', handlePatchLogUpload)

  return useCallback(async (args: PatchLogUpload) =>
    rename(args), [rename])
}
