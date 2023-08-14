import { useMemo } from 'react'

import { getGHUserClient } from 'github/userClient'
import { GitHubClient } from 'github/client'

export function useGitHubClient(accessToken?: string): GitHubClient | undefined {
  return useMemo(() => accessToken
    ? getGHUserClient({ accessToken })
    : undefined,
    [accessToken],
  )
}
