import {
  useState,
  useEffect,
} from 'react'
import clsx from 'clsx'

import ConfigureGitHubButton from 'components/ConfigureGitHubButton'
import AlertError from 'components/AlertError'
import { configureGitHubApp } from 'utils/github'
import { useGitHubClient } from 'hooks/useGitHubClient'
import SpinnerIcon from 'components/Spinner'
import { createRepo } from 'github/repo'

import RepoAccountSelect, { GitHubAccount } from './RepoAccountSelect'
import RepoNameInput from './RepoNameInput'

export interface Props {
  accessToken?: string
  accounts: GitHubAccount[]
  onConfigureGitHubAppClick: (e: any) => void
}

function NewRepository({
  accessToken,
  accounts,
  onConfigureGitHubAppClick,
}: Props) {
  const [name, setName] = useState('')
  const ghClient = useGitHubClient(accessToken)
  const [selectedAccount, setSelectedAccount] = useState<GitHubAccount | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreateClick() {
    if (!selectedAccount || !accessToken || !ghClient) return
    if (!name) return
    if (isLoading) return

    try {
      // TODO: Create a repository
      setError('')
      setIsLoading(true)
      const data = await createRepo({
        client: ghClient,
        org: selectedAccount.isOrg ? selectedAccount.name : undefined,
        name,
      })
      console.log('new repo data', data)

      // TODO: Check if we have permissions to the new repository,
      // if not - present UI that asks user for a permission to the new repository
      // if we do - select the new repo
    } catch (err: any) {
      console.error('Error creating repository', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(function selectDefaultAccount() {
    if (accounts.length > 0) setSelectedAccount(accounts[0])
  }, [accounts])

  return (
    <div
      className={clsx(
        'p-2 flex-1 flex flex-col space-y-4 items-center justify-start rounded-md',
        !accessToken && 'border border-gray-700',
      )}
    >
      {!accessToken && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="mb-2 text-sm text-gray-400 font-semibold text-center">
            We need access to a GitHub account to create new repositories
          </span>
          <ConfigureGitHubButton
            onClick={onConfigureGitHubAppClick}
          />
        </div>
      )}

      {accessToken && (
        <>
          <RepoAccountSelect
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelectedAccountChange={setSelectedAccount}
            onAddGithubAccountClick={configureGitHubApp}
          />

          <RepoNameInput
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <button
            className="w-8 min-w-[64px] flex items-center justify-center rounded bg-white/10 px-2 py-1 text-sm text-white font-medium hover:bg-white/20"
            onClick={handleCreateClick}
          >
            {isLoading ? (
              <SpinnerIcon />
            ) : (
              <span>Create</span>
            )}
          </button>

          {error && (
            <AlertError
              title="Error creating repository"
              infoItems={[error]}
            />
          )}
        </>
      )}
    </div>
  )
}

export default NewRepository
