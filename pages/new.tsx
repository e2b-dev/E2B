import {
  useState,
  Reducer,
  useReducer,
} from 'react'
import {
  LayoutGrid,
} from 'lucide-react'
import { useRouter } from 'next/router'
import humanId from 'human-id'
import useSWRMutation from 'swr/mutation'

import Text from 'components/Text'
import NewProjectIDForm from 'components/NewProjectIDForm'
import NewProjectTemplateForm from 'components/NewProjectTemplateForm'
import {
  CreationState,
  CreationEvent,
} from 'utils/newProjectState'

const invalidChars = /[^a-zA-Z0-9\-]/

interface PostProjectBody {
  id: string
}

const reducer: Reducer<CreationState, CreationEvent> = (state, event) => {
  switch (state) {
    case CreationState.SelectingID:
      if (event === CreationEvent.ConfirmID) return CreationState.SelectingTemplate
      if (event === CreationEvent.Fail) return CreationState.Faulted
      break
    case CreationState.SelectingTemplate:
      if (event === CreationEvent.Back) return CreationState.SelectingID
      if (event === CreationEvent.Fail) return CreationState.Faulted
      if (event === CreationEvent.ConfirmTemplate) return CreationState.CreatingProject
      break
    case CreationState.CreatingProject:
      if (event === CreationEvent.Fail) return CreationState.Faulted
      break
  }
  return state
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
  const [state, dispatch] = useReducer(reducer, CreationState.SelectingID)
  const [err, setErr] = useState<string>()


  const [projectID, setProjectID] = useState(() => humanId({
    separator: '-',
    capitalize: false,
  }))

  const trimmedID = projectID.trim()
  const hasInvalidChar = invalidChars.test(trimmedID)

  const router = useRouter()

  const {
    trigger: createProject,
  } = useSWRMutation('/api/project', handlePostProject)

  async function confirmTemplate() {
    dispatch(CreationEvent.ConfirmTemplate)

    try {
      const project = await createProject({
        id: trimmedID
      })

      if (project && 'statusCode' in project) {
        setErr(`Project with name "${trimmedID}" already exists`)
        dispatch(CreationEvent.Fail)
        return
      }

      router.push({
        pathname: '/[projectID]',
        query: {
          projectID: trimmedID,
        },
      })
    } catch (err: any) {
      console.error(err)
      setErr(err)
      dispatch(CreationEvent.Fail)
    }
  }

  async function confirmProjectID() {
    setErr(undefined)

    if (hasInvalidChar) {
      setErr('Project name must be a combination of letters, numbers and dashes')
      dispatch(CreationEvent.Fail)
      return
    }

    if (trimmedID.length > 63) {
      setErr('Project name is too long. It must have 63 or less characters')
      dispatch(CreationEvent.Fail)
      return
    }

    dispatch(CreationEvent.ConfirmID)
  }

  return (
    <div className="
      flex
      flex-1
      flex-col
      space-x-0
      space-y-8
      overflow-hidden
      p-8
      lg:p-12
    ">
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
              text="Configure New Project"
              className="text-base"
            />
          </div>
          {state === CreationState.SelectingID &&
            <NewProjectIDForm
              value={projectID}
              onChange={v => setProjectID(v)}
              error={err}
              isNextDisabled={!projectID || hasInvalidChar}
              onNext={confirmProjectID}
            />
          }
          {(state === CreationState.SelectingTemplate || state === CreationState.CreatingProject) &&
            <NewProjectTemplateForm
              onBack={() => dispatch(CreationEvent.Back)}
              onCreate={confirmTemplate}
              state={state}
            />
          }
          {err &&
            <Text
              className="
                self-center
                text-red-500
                font-medium
              "
              size={Text.size.S2}
              text={err}
            />
          }
        </div>
      </div>
    </div>
  )
}

export default NewProject
