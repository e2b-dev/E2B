import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'
import { AgentChallengeTag } from 'utils/agentLogs'

export interface PostLogUploadTag {
  id: string
  tag: AgentChallengeTag
}

export interface PostLogUploadTagResponse { }

async function handlePostLogUploadTag(url: string, { arg }: { arg: PostLogUploadTag }) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as PostLogUploadTagResponse
}

export function useAddLogUploadTag() {
  const {
    trigger: upload,
  } = useSWRMutation('/api/log_upload/tag', handlePostLogUploadTag)

  return useCallback(async (logUploadID: string, tag: AgentChallengeTag) =>
    upload({
      id: logUploadID,
      tag,
    }), [upload])
}
