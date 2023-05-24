import {
  useEffect,
  useState,
} from 'react'
import useSWRMutation from 'swr/mutation'
import humanId from 'human-id'
import {
  GitBranch,
  LayoutGrid,
  Folder,
  GithubIcon,
  ExternalLink,
  ArrowRight,
} from 'lucide-react'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import Link from 'next/link'
import dynamic from 'next/dynamic'

import { PostProjectBody } from 'pages/api/project'
import { apps } from 'database'
import Text from 'components/Text'
import Input from 'components/Input'
import Select from 'components/Select'
import { defaultRepoPath } from 'utils/constants'
import Button from 'components/Button'
import SpinnerIcon from 'components/Spinner'
const Repos = dynamic(() => import('components/Repos'), { ssr: false })

async function handlePostProject(url: string, { arg }: { arg: PostProjectBody }) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),

    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

const re = /[^a-zA-Z0-9\-]/

export default function NewProject() {
  const [isCreating, setIsCreating] = useState(false)
  const [repoSetup, setRepoSetup] = useState<Pick<PostProjectBody, 'accessToken' | 'installationID' | 'repositoryID'> & { fullName: string, defaultBranch: string, branches?: string[], url: string }>()
  const [projectSetup, setProjectSetup] = useState<Pick<PostProjectBody, 'path' | 'branch' | 'id'>>()
  const {
    trigger: createProject,
  } = useSWRMutation<Pick<apps, 'id' | 'repository_path'>>('/api/project', handlePostProject)
  const [err, setErr] = useState<string>()
  const router = useRouter()

  useEffect(function initProjectSetup() {
    if (!repoSetup) return
    setProjectSetup(s => ({
      id: s?.id || humanId({
        separator: '-',
        capitalize: false,
      }),
      branch: repoSetup.defaultBranch,
      path: s?.path || defaultRepoPath,
    }))
  }, [repoSetup])

  async function handleCreateProject() {
    if (!repoSetup || !projectSetup) return

    setErr(undefined)
    setIsCreating(true)

    const id = projectSetup.id.trim()

    if (re.test(id)) {
      setErr('Project name must be a combination of letters, numbers and dashes')
      setIsCreating(false)
      return
    }

    if (id.length > 63) {
      setErr('Project name is too long. It must have 63 or less characters')
      setIsCreating(false)
      return
    }

    try {
      const project = await createProject({
        ...projectSetup,
        ...repoSetup,
        id,
      })

      if (project && 'statusCode' in project) {
        setErr(`Project with name "${id}" already exists`)
        setIsCreating(false)
        return
      }

      router.push({
        pathname: '/projects/[id]',
        query: {
          id,
        },
      })
    } catch (err) {
      console.error(err)
      setIsCreating(false)
    }
  }

  return (
    <div
      className="
    flex
    flex-1
    flex-col
    space-x-0
    space-y-8
    overflow-hidden
    p-8
    lg:p-12
  "
    >
      <div className="flex">
        <div className="items-center flex space-x-2">
          <LayoutGrid size="30px" strokeWidth="1.5" />
          <Text
            size={Text.size.S1}
            text="Create New Project"
          />
        </div>
      </div>

      <div className="flex flex-1 justify-center overflow-hidden min-h-[200px]">
        <div className="w-[450px] max-h-[600px] flex flex-col space-y-2 overflow-hidden">
          <div className="flex space-x-2 items-center transition-all">
            <Text
              text="Select repository"
              className={clsx('text-base', { 'text-slate-300 hover:text-green-800 cursor-pointer': repoSetup })}
              onClick={() => setRepoSetup(undefined)}
            />
            <ArrowRight size="18px" className="text-slate-300" />
            <Text
              text="Configure project"
              className={clsx(
                'text-base',
                { 'text-slate-300': !repoSetup },
              )}
            />
          </div>
          <div
            className={clsx(
              'flex overflow-hidden flex-1',
              { 'hidden': repoSetup },
            )}
          >
            <Repos
              onRepoSelection={setRepoSetup}
            />
          </div>
          {repoSetup &&
            <div className="space-y-2 flex-1 flex flex-col">
              <div
                className="space-y-6 rounded border p-8 flex flex-col bg-white"
              >
                <div className="flex flex-col space-y-6">
                  <div className="flex flex-col flex-1 space-y-1">
                    <Input
                      title="Must be a combination of letters, numbers and dashes"
                      pattern="[^a-zA-Z0-9\-]"
                      label="Project name"
                      placeholder="Project name"
                      value={projectSetup?.id}
                      onChange={v => setProjectSetup(p => p ? ({ ...p, id: v }) : undefined)}
                      required
                      autofocus
                    />
                    <Text
                      text="Combination of letters, numbers and dashes"
                      size={Text.size.S3}
                      className="text-slate-400"
                    />
                  </div>

                  <div className="flex space-x-2 items-start">
                    <GithubIcon size="16px" />
                    <div className="flex flex-col space-y-1">
                      <Text text="Repository" size={Text.size.S3} />
                      <Link
                        href={{
                          pathname: repoSetup.url,
                        }}
                        className="flex space-x-1 hover:text-blue-600"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Text
                          text={`${repoSetup?.fullName}`}
                          className="font-semibold underline"
                        />
                        <ExternalLink size="12px" />
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <GitBranch size="16px" />
                    <div className="flex flex-col space-y-1">
                      <Text text="Branch" size={Text.size.S3} />
                      <Select
                        items={(repoSetup?.branches || []).map(r => ({
                          label: r,
                          value: r,
                        })).sort((a, b) => {
                          return a.label.localeCompare(b.label)
                        })}
                        onSelect={(i) => {
                          setProjectSetup(s => s ? ({ ...s, branch: i?.value || s.branch }) : undefined)
                        }}
                        selectedItemLabel={projectSetup?.branch}
                        isTransparent
                      />
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Folder size="16px" />
                    <Input
                      label="Root directory"
                      placeholder="Root directory"
                      value={projectSetup?.path}
                      onChange={v => setProjectSetup(p => p ? ({ ...p, path: v }) : undefined)}
                      isTransparent
                    />
                  </div>
                </div>
                <div className="flex justify-center flex-col space-y-4">
                  <Button
                    isDisabled={!projectSetup || !repoSetup || !projectSetup.id || !projectSetup.branch || !projectSetup.path || isCreating || re.test(projectSetup.id.trim())}
                    onClick={handleCreateProject}
                    text={isCreating ? 'Creating & deploying' : 'Create project'}
                    variant={Button.variant.Full}
                    className="self-center whitespace-nowrap"
                    icon={isCreating ? <SpinnerIcon className="text-white" /> : null}
                  />
                  {!isCreating && err && (
                    <Text
                      className="self-center text-red-500"
                      size={Text.size.S3}
                      text={err}
                    />
                  )}
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  )
}
