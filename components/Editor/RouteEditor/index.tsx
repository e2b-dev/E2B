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
          {requestBodyBlock &&
            <RequestBodyEditor
              block={requestBodyBlock}
              onChange={updateRequestBodyBlock}
            />
          }
          {promptBlock1 &&
            <PromptEditor
              block={promptBlock1}
              onChange={updatePromptBlock1}
            />
          }
          {promptBlock2 &&
            <PromptEditor
              block={promptBlock2}
              onChange={updatePromptBlock2}
            />
          }
          {promptBlock3 &&
            <PromptEditor
              block={promptBlock3}
              onChange={updatePromptBlock3}
            />
          }
        </div>
      }
    </div >
  )
}

export default RouteEditor
