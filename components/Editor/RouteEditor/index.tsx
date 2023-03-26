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
      items-start
      overflow-hidden
    ">
      {!route &&
        <div>No route selected</div>
      }
      {route &&
        <>
          <div className="flex items-center space-x-2">
            <Select
              direction="left"
              selectedValue={{ key: route?.method, title: route.method.toUpperCase() }}
              values={methods.map(m => ({ key: m, title: m.toUpperCase() }))}
              onChange={m => changeRoute(route.id, { method: m.key as Method })}
            />
          </div>
          <div className="
          flex
          flex-1
          flex-col
          items-start
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
        </>
      }
    </div >
  )
}

export default RouteEditor
