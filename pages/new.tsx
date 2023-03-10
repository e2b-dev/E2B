import {
  useState,
} from 'react'
import {
  LayoutGrid,
} from 'lucide-react'
import { useRouter } from 'next/router'
import humanId from 'human-id'
import useSWRMutation from 'swr/mutation'

import Text from 'components/Text'
import Input from 'components/Input'
import Button from 'components/Button'
import SpinnerIcon from 'components/Spinner'

const re = /[^a-zA-Z0-9\-]/

interface PostProjectBody {
  id: string
}

async function handlePostProject(url: string, { arg }: { arg: PostProjectBody }) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),

    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

function NewProject() {
  const [isCreating, setIsCreating] = useState(false)
  const [projectID, setProjectID] = useState(() => humanId({
    separator: '-',
    capitalize: false,
  }))

  const trimmedID = projectID.trim()
  const validatedID = re.test(trimmedID)

  const [err, setErr] = useState<string>()
  const router = useRouter()

  const {
    trigger: createProject,
  } = useSWRMutation('/api/project', handlePostProject)

  async function handleCreateProject() {
    setErr(undefined)
    setIsCreating(true)

    if (validatedID) {
      setErr('Project name must be a combination of letters, numbers and dashes')
      setIsCreating(false)
      return
    }

    if (trimmedID.length > 63) {
      setErr('Project name is too long. It must have 63 or less characters')
      setIsCreating(false)
      return
    }

    try {
      const project = await createProject({
        id: trimmedID
      })

      if (project && 'statusCode' in project) {
        setErr(`Project with name "${trimmedID}" already exists`)
        setIsCreating(false)
        return
      }

      router.push({
        pathname: '/[projectID]',
        query: {
          projectID: trimmedID,
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
              text="Configure project"
              className="text-base"
            />
          </div>
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
                    value={projectID}
                    onChange={v => setProjectID(v)}
                    required
                    autofocus
                  />
                  <Text
                    text="Combination of letters, numbers and dashes"
                    size={Text.size.S3}
                    className="text-slate-400"
                  />
                </div>

              </div>
              <div className="flex justify-center flex-col space-y-4">
                <Button
                  isDisabled={!projectID || isCreating || validatedID}
                  onClick={handleCreateProject}
                  text={isCreating ? 'Creating...' : 'Create project'}
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
        </div>
      </div>
    </div>
  )
}

export default NewProject
