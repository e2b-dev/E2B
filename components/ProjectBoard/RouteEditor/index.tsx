import { Fragment } from 'react'

import Select from 'components/Select'
import { methods, Method, Route } from 'state/store'

import PromptEditor from './PromptEditor'
import RequestBodyEditor from './RequestBodyEditor'
import { useStateStore } from 'state/StoreProvider'

export interface Props {
  route?: Route
}

function RouteEditor({ route }: Props) {
  const store = useStateStore()

  const changeRoute = store.use.changeRoute()
  const changeBlock = store.use.changeBlock()

  return (
    <div className="
      py-2
      px-4
      flex
      flex-1
      items-start
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
          items-center
          overflow-auto
          scroller
          bg-white
          relative
        ">
            <div className="
            flex
            flex-col
            items-center
            transition-all
            flex-1
          ">
              {route.blocks.map((b, i) =>
                <Fragment
                  key={b.id}
                >
                  {b.type === 'RequestBody' &&
                    <RequestBodyEditor
                      block={b}
                      onChange={b => changeBlock(route.id, i, b)}
                    />
                  }
                  {b.type === 'StructuredProse' &&
                    <PromptEditor
                      initialContent={b.prompt}
                      onContentChange={c => changeBlock(route.id, i, { ...b, prompt: c })}
                    />
                  }
                </Fragment>
              )}
            </div>
          </div>
        </>
      }
    </div>
  )
}

export default RouteEditor
