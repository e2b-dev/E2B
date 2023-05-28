import type { GetServerSideProps } from 'next'
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import {
  useUser,
  useSession,
} from '@supabase/auth-helpers-react'
import useSWRMutation from 'swr/mutation'
import { nanoid } from 'nanoid'
import { useState } from 'react'

import { serverCreds } from 'db/credentials'
import Repos, { RepoSetup } from 'components/Repos'
import Button from 'components/Button'
import { getDefaultModelConfig, getModelArgs, ModelConfig } from 'state/model'
import { TemplateID } from 'state/template'
import { Creds } from 'hooks/useModelProviderArgs'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = createServerSupabaseClient(ctx, serverCreds)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return {
      redirect: {
        destination: '/agent/smol-developer',
        permanent: false,
      },
    }
  }

  return { props: {} }
}

export interface PostAgentBody {
  // ID of the installation of the GitHub App
  installationID: number
  // ID of the repository
  repositoryID: number
  // Title of the PR
  title: string
  // Default branch against which to create the PR
  defaultBranch: string
  // Initial prompt used as a body text for the PR (can be markdown)
  body: string
  // Owner of the repo (user or org)
  owner: string
  // Name of the repo
  repo: string
  // Name of the branch created for the PR
  branch: string
  // Commit message for the PR first empty commit
  commitMessage: string
  modelConfig: ModelConfig
}

async function handlePostAgent(url: string, { arg }: { arg: PostAgentBody }) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),

    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

function getSmolDevModelConfig(creds: Creds): ModelConfig {
  const templateID = TemplateID.SmolDeveloper
  const modelConfig = getDefaultModelConfig(templateID)
  return {
    name: modelConfig.name,
    provider: modelConfig.provider,
    args: getModelArgs(modelConfig, creds),
    prompt: [],
  }
}

function Repo() {
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const session = useSession()
  const sessionCtx = useSessionContext()
  const [selectedRepo, setSelectedRepo] = useState<RepoSetup>()
  const [initialPrompt, setInitialPrompt] = useState<string>()
  const [openAIAPIKey, setOpenAIAPIKey] = useState<string>()

  async function signOut() {
    await supabaseClient.auth.signOut()
    location.reload()
  }

  const {
    trigger: createAgent,
  } = useSWRMutation('/api/agent', handlePostAgent)

  async function deployAgent() {
    if (!selectedRepo) return
    if (!initialPrompt) return
    if (!openAIAPIKey) return
    console.log('selectedRepo', selectedRepo)

    const modelConfig = getSmolDevModelConfig({
      OpenAI: {
        creds: {
          openai_api_key: openAIAPIKey,
        },
      },
    })

    await createAgent({
      defaultBranch: selectedRepo.defaultBranch,
      installationID: selectedRepo.installationID,
      owner: selectedRepo.owner,
      repo: selectedRepo.repo,
      repositoryID: selectedRepo.repositoryID,
      title: 'Smol PR',
      branch: `pr/smol-dev/${nanoid(6).toLowerCase()}`,
      body: initialPrompt,
      commitMessage: 'Smol dev initial commit',
      modelConfig,
    })
  }

  return (
    <div
      className="
      p-8
      flex-1
      flex
      flex-col
      space-y-4
    "
    >
      <div
        className="
      max-w-xl
      w-full
      max-h-[800px]
      flex-1
      flex
      flex-col
      self-center
      justify-center
      space-y-4
    "
      >
        {!sessionCtx.isLoading && user && (
          <Button
            text="Sign out"
            onClick={signOut}
          />
        )}
        Select repo
        {user &&
          <Repos
            onRepoSelection={setSelectedRepo}
          />
        }
      </div>
      <Button
        text='Deploy Smol developer'
        onClick={deployAgent}
      />
    </div>
  )
}

export default Repo
