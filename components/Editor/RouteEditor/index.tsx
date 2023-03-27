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
  const store = useStateStore()
  const changeRoute = store.use.changeRoute()

  const [requestBodyBlock, updateRequestBodyBlock] = useBlock('RequestBody', route)
  const [promptBlock, updatePromptBlock] = useBlock('StructuredProse', route)

  return (
    <div className="
      py-2
      px-4
      flex
      flex-1
      bg-white
      justify-center
      overflow-hidden
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
          flex-1
          flex-col
          bg-slate-400
          items-center
          max-w-[65ch]
          min-h-0
          overflow-auto
          scroller
          space-y-2
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
