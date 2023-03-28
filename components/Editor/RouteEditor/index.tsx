import { Route } from 'state/store'
import useBlock from 'hooks/useBlock'

import PromptEditor from './PromptEditor'
import RequestBodyEditor from './RequestBodyEditor'

export interface Props {
  route?: Route
}

function RouteEditor({ route }: Props) {
  const [requestBodyBlock, updateRequestBodyBlock] = useBlock('RequestBody', 1, route)
  const [promptBlock1, updatePromptBlock1] = useBlock('StructuredProse', 1, route)
  const [promptBlock2, updatePromptBlock2] = useBlock('StructuredProse', 2, route)
  const [promptBlock3, updatePromptBlock3] = useBlock('StructuredProse', 3, route)

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
          {promptBlock1 &&
            <PromptEditor
              title="What will this route do?"
              placeholder="This is an API endpoint that ..."
              block={promptBlock1}
              onChange={updatePromptBlock1}
            />
          }
          {requestBodyBlock &&
            <RequestBodyEditor
              block={requestBodyBlock}
              onChange={updateRequestBodyBlock}
            />
          }
          {promptBlock2 &&
            <PromptEditor
              title="Step-by-step implementation"
              placeholder="1. Check if the incoming `email` is not empty ..."
              block={promptBlock2}
              onChange={updatePromptBlock2}
            />
          }
        </div>
      }
    </div >
  )
}

export default RouteEditor
