import React, { useCallback, useMemo, useState } from 'react'
import { GithubIcon, SearchIcon } from 'lucide-react'
import clsx from 'clsx'
import Fuse from 'fuse.js'

import useListenOnMessage from 'hooks/useListenOnMessage'
import Button from 'components/Button'
import Text from 'components/Text'
import { useGitHubClient } from 'hooks/useGitHubClient'
import { useRepositories } from 'hooks/useRepositories'

import { openPopupModal } from 'utils/popupModal'
import TitleButton from 'components/TitleButton'
import Input from 'components/Input'
import SpinnerIcon from 'components/Spinner'
import { useLocalStorage } from 'hooks/useLocalStorage'
import { createRepo, parseRepoName } from 'github/repo'

export interface RepoSetup {
  fullName: string
  repositoryID: number
  installationID: number
  defaultBranch: string
  branches?: string[]
  url: string
  owner: string
  repo: string
}

export interface Props {
  onRepoSelection: (repoSetup: RepoSetup) => void
}

function Repos({ onRepoSelection }: Props) {
  const [accessToken, setAccessToken] = useLocalStorage<string | undefined>('gh_access_token', undefined)
  const gitHub = useGitHubClient(accessToken)
  const { repos, refetch } = useRepositories(gitHub)
  const [query, setQuery] = useState<string>()


  async function createEmptyRepository(name: string) {
    if (!gitHub) return

    await createRepo({ client: gitHub, name })
    // When we refresh the list of repos now the new repo will be there
    // if we gave the GH App permissions to access all the personal repos or repos for the org

    refetch()
  }

  const searchEngine = useMemo(() => repos ?
    new Fuse(repos, {
      keys: ['full_name'],
      threshold: 0.4,
    }) : undefined
    , [repos])

  const filteredRepos = query && searchEngine ? searchEngine.search(query).map(i => i.item) : repos || []

  const handleMessageEvent = useCallback((event: MessageEvent) => {
    if (event.data.accessToken) {
      setAccessToken(event.data.accessToken)
    } else if (event.data.installationID) {
      refetch()
    }
  }, [refetch, setAccessToken])
  useListenOnMessage(handleMessageEvent)

  async function selectRepository(r: Omit<RepoSetup, 'branches' | 'owner' | 'repo'>) {
    const { owner, repo } = parseRepoName(r.fullName)

    onRepoSelection({
      ...r,
      branches: [r.defaultBranch],
      owner,
      repo,
    })

    const [repositoryOwnerName, repositoryName] = r.fullName.split('/')
    const repoBranches = await gitHub?.repos.listBranches({
      owner: repositoryOwnerName,
      repo: repositoryName,
    })

    const branches = repoBranches?.data.map(b => b.name)
    onRepoSelection({
      ...r,
      branches,
      owner,
      repo,
    })
  }

  async function signWithGitHubOAuth() {
    const url = new URL('/login/oauth/authorize', 'https://github.com')
    url.searchParams.set('client_id', process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!)
    openPopupModal(url)
  }

  function configureGitHubApp() {
    const url = new URL('https://github.com/apps/e2b-for-github/installations/new')
    openPopupModal(url)
  }

  return (
    <div className="flex flex-1 flex-col space-y-2 overflow-hidden">
      <div className={clsx(`
        border
        overflow-hidden
        rounded
        flex
        flex-col
        flex-1`,
        { 'bg-white': accessToken },
      )}>
        {!accessToken &&
          <div className="flex flex-1 justify-center items-center">
            <Button
              variant={Button.variant.Full}
              onClick={configureGitHubApp}
              text="Add GitHub Repository"
              icon={<GithubIcon />}
            />
          </div>
        }

        {accessToken &&
          <div className="flex overflow-hidden flex-col flex-1">
            <div className="flex items-center space-x-2 border-b px-8 py-4">
              <SearchIcon size="16px" />
              <Input
                placeholder="Search repositories..."
                value={query}
                onChange={q => setQuery(q)}
                autofocus
              />
            </div>


            {!repos &&
              <div className="flex flex-1 items-center justify-center flex-col space-y-1 text-slate-500">
                <SpinnerIcon className="text-slate-400" />
                <Text text="Fetching repositories" />
              </div>
            }

            {repos && repos.length === 0 &&
              <div className="flex flex-1 items-center justify-center flex-col space-y-1">
                <Text text="No connected repositories found" />
                <Button
                  variant={Button.variant.Full}
                  onClick={configureGitHubApp}
                  text="Configure permissions"
                  icon={<GithubIcon />}
                />
              </div>
            }

            {repos && repos.length > 0 &&
              <div className="
                flex
                flex-col
                scroller
                overflow-auto
                pl-8
                flex-1
                pr-6
              ">
                {filteredRepos.map(r => (
                  <div
                    className={clsx(
                      'flex',
                      'justify-between',
                      'py-4',
                      'border-b',
                    )}
                    key={r.id}
                  >
                    <div className="flex items-center space-x-2">
                      <GithubIcon size="16px" />
                      <Text text={r.full_name} className="" />
                    </div>
                    <Button
                      onClick={() => selectRepository({
                        defaultBranch: r.default_branch,
                        installationID: r.installation_id,
                        repositoryID: r.id,
                        fullName: r.full_name,
                        url: r.html_url,
                      })}
                      text="Select"
                    />
                  </div>
                ))}
              </div>
            }
          </div>
        }
      </div>
      {<Button
        onClick={() => createEmptyRepository('test')}
        text="Create Empty Repository"
      />}
      {accessToken &&
        <div className="flex justify-between">
          <TitleButton
            onClick={signWithGitHubOAuth}
            text="Reauthenticate GitHub Account"
          />
          <TitleButton
            onClick={configureGitHubApp}
            text="Configure GitHub App"
          />
        </div>
      }
    </div>
  )
}

export default Repos
