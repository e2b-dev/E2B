import {
  useEffect,
  useReducer,
} from 'react'
import clsx from 'clsx'
import { usePostHog } from 'posthog-js/react'

import ConfigureGitHubButton from 'components/ConfigureGitHubButton'
import AlertError from 'components/AlertError'
import {
  configureGitHubApp,
  GitHubAccount,
} from 'utils/github'
import { useGitHubClient } from 'hooks/useGitHubClient'
import SpinnerIcon from 'components/Spinner'
import { createRepo } from 'github/repo'
import { RepoSetup } from 'utils/repoSetup'

import RepoAccountSelect from './RepoAccountSelect'
import RepoNameInput from './RepoNameInput'
import PermissionsModal from './PermissionsModal'
import {
  creationReducer,
  ActionType,
} from './newRepoState'

export interface Props {
  accessToken?: string
  accounts: GitHubAccount[]
  onConfigureGitHubAppClick: (e: any) => void
  onRepoSelection: (repo: RepoSetup) => void
}

function NewRepository({
  accessToken,
  accounts,
  onConfigureGitHubAppClick,
  onRepoSelection,
}: Props) {
  const ghClient = useGitHubClient(accessToken)
  const posthog = usePostHog()

  const [state, dispatch] = useReducer(creationReducer, {
    name: '',
    account: null,
    isCreating: false,
    requiresPermissions: false,
  })

  async function handleCreateClick() {
    if (!accessToken || !ghClient) return
    if (!state.account) return
    if (!state.name) return
    if (state.isCreating) return

    posthog?.capture('created repository', {
      account: state.account.name,
      repository: `${state.account.name}/${state.name}`,
    })

    try {
      dispatch({ type: ActionType.Create, payload: {} })
      const newRepo = await createRepo({
        client: ghClient,
        org: state.account.isOrg ? state.account.name : undefined,
        name: state.name,
      })
      dispatch({ type: ActionType.Success, payload: {} })

      onRepoSelection({
        fullName: newRepo.full_name,
        defaultBranch: newRepo.default_branch,
        repositoryID: newRepo.id,
        owner: newRepo.owner.login,
        installationID: state.account.installationID,
        repo: newRepo.name,
        url: newRepo.url,
      })
    } catch (err: any) {
      console.error('Error creating repository', err)
      dispatch({ type: ActionType.Fail, payload: { error: err } })
    }
  }

  useEffect(function selectDefaultAccount() {
    if (accounts.length === 0) return
    dispatch({ type: ActionType.SelectAccount, payload: { account: accounts[0] } })
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
            selectedAccount={state.account}
            onSelectedAccountChange={acc => dispatch({ type: ActionType.SelectAccount, payload: { account: acc } })}
            onAddGithubAccountClick={configureGitHubApp}
          />

          <RepoNameInput
            value={state.name}
            onChange={e => dispatch({ type: ActionType.UpdateName, payload: { name: e.target.value } })}
          />

          <button
            className="w-8 min-w-[64px] h-[24px] min-h-[24px] flex items-center justify-center rounded bg-white/10 px-2 py-1 text-sm text-white font-medium hover:bg-white/20"
            onClick={handleCreateClick}
          >
            {state.isCreating ? (
              <SpinnerIcon />
            ) : (
              <span>Create</span>
            )}
          </button>


          {state.requiresPermissions && (
            <PermissionsModal />
          )}

          {state.error && (
            <AlertError
              title="Error creating repository"
              infoItems={[state.error.message]}
            />
          )}
        </>
      )}
    </div>
  )
}

export default NewRepository
