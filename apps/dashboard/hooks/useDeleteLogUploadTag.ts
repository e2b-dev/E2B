import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'
import { AgentChallengeTag } from 'utils/agentLogs'

export interface DeleteLogUploadTag {
  // Log Upload ID
  id: string
  tag: AgentChallengeTag
}

export interface DeleteLogUploadTagResponse { }

async function handleDeleteLogUploadTag(url: string, { arg }: { arg: DeleteLogUploadTag }) {
  const response = await fetch(url, {
    method: 'DELETE',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as DeleteLogUploadTagResponse
}

export function useDeleteLogUploadTag() {
  const {
    trigger: remove,
  } = useSWRMutation('/api/log_upload/tag', handleDeleteLogUploadTag)

  return useCallback(async (logUploadID: string, tag: AgentChallengeTag) => remove({
    id: logUploadID,
    tag,
  }), [remove])
}
