import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'

export interface DeleteLogs {
  id: string
}

export interface DeleteLogsResponse { }

async function handleDeleteLogs(url: string, { arg }: { arg: DeleteLogs }) {
  const response = await fetch(url, {
    method: 'DELETE',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as DeleteLogsResponse
}

export function useDeleteLogs() {
  const {
    trigger: remove,
  } = useSWRMutation('/api/logs', handleDeleteLogs)

  return useCallback(async (logID: string) => remove({
    id: logID,
  }), [remove])
}
