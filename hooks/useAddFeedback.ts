import { useCallback } from 'react'
import useSWRMutation from 'swr/mutation'


export interface PostFeedback {
  feedback: string
}

export interface PostFeedbackResponse {
}

async function handlePostFeedback(url: string, { arg }: { arg: PostFeedback }) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as PostFeedbackResponse
}

export function useAddFeedback() {
  const {
    trigger,
  } = useSWRMutation('/api/feedback', handlePostFeedback)

  return useCallback(async (feedback: string) =>
    trigger({
      feedback,
    }), [trigger])
}
