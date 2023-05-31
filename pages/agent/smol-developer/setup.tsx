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
  modelConfig: ModelConfig & { templateID: TemplateID }
}

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

async function handlePostAgent(url: string, { arg }: { arg: PostAgentBody }) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as { issueID: string }
}

function getSmolDevModelConfig(creds: Creds): ModelConfig & { templateID: TemplateID } {
  const templateID = TemplateID.SmolDeveloper
  const modelConfig = getDefaultModelConfig(templateID)
  return {
    name: modelConfig.name,
    provider: modelConfig.provider,
    args: getModelArgs(modelConfig, creds),
    prompt: [],
    templateID,
  }
}

function Repo() {
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const session = useSession()
  const sessionCtx = useSessionContext()
  const [selectedRepo, setSelectedRepo] = useState<RepoSetup>()
  const [initialPrompt, setInitialPrompt] = useState<string>('create chrome extension')
  const [openAIAPIKey, setOpenAIAPIKey] = useState<string>('')

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

  const people = [
    {
      name: 'Leslie Alexander',
      email: 'leslie.alexander@example.com',
      role: 'Co-Founder / CEO',
      imageUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      lastSeen: '3h ago',
      lastSeenDateTime: '2023-01-23T13:23Z',
    },
    {
      name: 'Michael Foster',
      email: 'michael.foster@example.com',
      role: 'Co-Founder / CTO',
      imageUrl:
        'https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      lastSeen: '3h ago',
      lastSeenDateTime: '2023-01-23T13:23Z',
    },
    {
      name: 'Dries Vincent',
      email: 'dries.vincent@example.com',
      role: 'Business Relations',
      imageUrl:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      lastSeen: null,
    },
    {
      name: 'Lindsay Walton',
      email: 'lindsay.walton@example.com',
      role: 'Front-end Developer',
      imageUrl:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      lastSeen: '3h ago',
      lastSeenDateTime: '2023-01-23T13:23Z',
    },
    {
      name: 'Courtney Henry',
      email: 'courtney.henry@example.com',
      role: 'Designer',
      imageUrl:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      lastSeen: '3h ago',
      lastSeenDateTime: '2023-01-23T13:23Z',
    },
    {
      name: 'Tom Cook',
      email: 'tom.cook@example.com',
      role: 'Director of Product',
      imageUrl:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      lastSeen: null,
    },
  ]

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
      max-h-[400px]
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
