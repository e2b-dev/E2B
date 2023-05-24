import { useEffect, useReducer, useState } from 'react'

import { GitHubUserClient } from 'github/userClient'

async function fetchRepos(client: GitHubUserClient) {
  const installations = await client.apps.listInstallationsForAuthenticatedUser()

  const repos = await Promise.all(
    installations.data.installations.map(async i => {
      try {
        const repos = await client.apps.listInstallationReposForAuthenticatedUser({
          installation_id: i.id,
          // TODO: Add pagination so we fetch all the repos not just the first 100
          per_page: 100,
          headers: {
            // We have to manually circumvent the caching mechanism here.
            // This request is called only when the user changes or when the component mounts, so we don't exceed the GitHub API quotas.
            'If-Modified-Since': 'Sun, 14 Nov 2021 13:42:15 GMT',
          },
        })
        return repos.data.repositories.map(r => ({
          ...r,
          installation_id: i.id,
        }))
      } catch (err) {
        console.error(err)
        return []
      }
    })
  )
  return repos.flat()
}

export function useRepositories(client?: GitHubUserClient) {
  const [repos, setRepos] = useState<Awaited<ReturnType<typeof fetchRepos>>>()
  const [hook, refetch] = useReducer(() => ({}), {})

  useEffect(function fetch() {
    if (!client) return
    fetchRepos(client).then(setRepos)
  }, [client, hook])

  return {
    repos,
    refetch,
  }
}
