import { useEffect, useReducer, useState } from 'react'
import { GitHubClient } from 'github/client'

export async function fetchRepos(client: GitHubClient) {
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

        return await Promise.all(repos.data.repositories.map(async r => {
          const langs = await client.repos.listLanguages({
            owner: r.owner.login,
            repo: r.name,
          })

          let language = ''
          if (langs.data && Object.keys(langs.data).length > 0) {
            // Pick the most used language
            language = Object.keys(langs.data).reduce((a, b) => (langs.data[a] || 0) > (langs.data[b] || 0) ? a : b)
          }
          return {
            ...r,
            installation_id: i.id,
            language,
          }
        }))
      } catch (err) {
        console.error(err)
        return []
      }
    })
  )
  return repos.flat()
}

export function useRepositories(client?: GitHubClient) {
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
