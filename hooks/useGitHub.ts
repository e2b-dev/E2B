import { useEffect, useState } from 'react'

import getUserClient, { GitHubUserClient } from 'github/userClient'

export function useGitHub(accessToken?: string) {
  const [gitHub, setGitHub] = useState<GitHubUserClient>()

  useEffect(function init() {
    if (!accessToken) return
    setGitHub(getUserClient({ accessToken }))
  }, [accessToken])

  return gitHub
}
