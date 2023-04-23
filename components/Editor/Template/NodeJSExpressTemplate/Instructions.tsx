import { useCallback } from 'react'

import useReferences from 'hooks/useReferences'

import InstructionsEditor from './InstructionsEditor'
import RequestBodyEditor from './RequestBodyEditor'
import { RouteInfo } from './useRoutes'

export interface Props {
  setRoute: (route: Partial<RouteInfo> & Pick<RouteInfo, 'id'>) => void,
  route?: RouteInfo
}

function RouteEditor({ route, setRoute }: Props) {
  const [referenceSearch] = useReferences()

  const updateDescription = useCallback((content: string) => {
    if (!route?.id) return
    setRoute({
      id: route.id,
      Description: content,
    })
  }, [route?.id, setRoute])

  const updateRequestBody = useCallback((content: string) => {
    if (!route?.id) return
    setRoute({
      id: route.id,
      RequestBody: content,
    })
  }, [route?.id, setRoute])

  const updateInstructions = useCallback((content: string) => {
    if (!route?.id) return
    setRoute({
      id: route.id,
      Instructions: content,
    })
  }, [route?.id, setRoute])

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
          space-y-6
          max-w-[65ch]
          grow
        ">
          <InstructionsEditor
            referenceSearch={referenceSearch}
            title="What should this route do?"
            placeholder="This is an API endpoint that ..."
            content={route.Description}
            onChange={updateDescription}
          />
          <RequestBodyEditor
            content={route.RequestBody}
            onChange={updateRequestBody}
          />
          <InstructionsEditor
            referenceSearch={referenceSearch}
            title="Step-by-step instructions"
            placeholder="1. Check if the incoming `email` is not empty ..."
            content={route.Instructions}
            onChange={updateInstructions}
          />
        </div>
      }
    </div >
  )
}

export default RouteEditor
