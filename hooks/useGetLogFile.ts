// Tries to fetch a log file from the DB based on the log file ID.
import { log_files } from '@prisma/client'
import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'

export interface GetLogFile {
  id: string
}

export interface GetLogResponse {
  // TODO
}

async function handleGetLog(url: string, { arg }: { arg: GetLogFile }) {
  if (!arg.id) { return }

  const response = await fetch(`${url}/${arg.id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as log_files
}

export function useGetLogFile() {
  const {
    trigger: getLog,
  } = useSWRMutation('/api/log_file', handleGetLog)

  return useCallback(async (logFileID: string) => getLog({
    id: logFileID,
  }), [getLog])
}