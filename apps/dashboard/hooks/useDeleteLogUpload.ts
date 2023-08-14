import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'

export interface DeleteLogUpload {
  // Log Upload ID
  id: string
}

export interface DeleteLogUploadResponse { }

async function handleDeleteLogUpload(url: string, { arg }: { arg: DeleteLogUpload }) {
  const response = await fetch(url, {
    method: 'DELETE',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as DeleteLogUploadResponse
}

export function useDeleteLogUpload() {
  const {
    trigger: remove,
  } = useSWRMutation('/api/log_upload', handleDeleteLogUpload)

  return useCallback(async (logUploadID: string) => remove({
    id: logUploadID,
  }), [remove])
}
