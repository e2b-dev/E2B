import Select from 'components/Select'
import { methods, Method, Route } from 'state/store'
import { useStateStore } from 'state/StoreProvider'
import useBlock from 'hooks/useBlock'

import PromptEditor from './PromptEditor'
import RequestBodyEditor from './RequestBodyEditor'

export interface Props {
  route?: Route
}

function RouteEditor({ route }: Props) {
  const [requestBodyBlock, updateRequestBodyBlock] = useBlock('RequestBody', route)
  const [promptBlock, updatePromptBlock] = useBlock('StructuredProse', route)

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
          {promptBlock &&
            <PromptEditor
              block={promptBlock}
              onChange={updatePromptBlock}
            />
          }
        </div>
      }
    </div >
  )
}

export default RouteEditor
