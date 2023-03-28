import { Route } from 'state/store'
import useBlock from 'hooks/useBlock'

import PromptEditor from './PromptEditor'
import RequestBodyEditor from './RequestBodyEditor'

export interface Props {
  route?: Route
}

function RouteEditor({ route }: Props) {
  const [requestBodyBlock, updateRequestBodyBlock] = useBlock('RequestBody', 1, route)
  const [descriptionBlock, updateDescriptionBlock] = useBlock('Description', 1, route)
  const [instructionsBlock, updateInstructionsBlock] = useBlock('Instructions', 1, route)

  return (
    <div className="
      py-8
      px-4
      flex
      flex-1
      bg-white
      justify-center
      overflow-auto
      scroller
    ">
      {!route &&
        <div className="
          text-slate-400
          self-center
        ">
          No route selected
        </div>
      }
      {route &&
        <div className="
          flex
          flex-col
          items-start
          space-y-8
        ">
          {descriptionBlock &&
            <PromptEditor
              title="What should this route do?"
              placeholder="This is an API endpoint that ..."
              block={descriptionBlock}
              onChange={updateDescriptionBlock}
            />
          }
          {requestBodyBlock &&
            <RequestBodyEditor
              block={requestBodyBlock}
              onChange={updateRequestBodyBlock}
            />
          }
          {instructionsBlock &&
            <PromptEditor
              title="Step-by-step instructions"
              placeholder="1. Check if the incoming `email` is not empty ..."
              block={instructionsBlock}
              onChange={updateInstructionsBlock}
            />
          }
        </div>
      }
    </div >
  )
}

export default RouteEditor
