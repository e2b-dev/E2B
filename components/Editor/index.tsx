import { useCallback, useEffect, useState } from 'react'
import { projects } from '@prisma/client'
import Splitter, { GutterTheme } from '@devbookhq/splitter'
import { useLocalStorage } from 'usehooks-ts'

import { useStateStore } from 'state/StoreProvider'

import Routes from './Routes'
import Sidebar from './Sidebar'
import RouteEditor from './RouteEditor'

export interface Props {
  project: projects
}

function Editor({ project }: Props) {
  const store = useStateStore()

  // TODO: Handle editor state differently so we don't rerender this component on each editor edit.
  const routes = store.use.routes()
  const deleteRoute = store.use.deleteRoute()

  const [selectedRouteID, setSelectedRouteID] = useState(() => routes.length > 0 ? routes[0].id : undefined)
  const selectedRoute = routes.find(s => s.id === selectedRouteID)

  useEffect(function selectDefaultRoute() {
    if (selectedRoute?.id || routes.length === 0) return
    setSelectedRouteID(routes[0].id)
  }, [routes, selectedRoute?.id])

  function handleDeleteRoute(id: string) {
    deleteRoute(id)
    setSelectedRouteID(r => {
      if (r === id) {
        return routes.length > 0 ? routes[0].id : undefined
      }
    })
  }

  const [sizes, setSizes] = useLocalStorage('project-board-splitter-sizes', [60, 40])
  const handleResize = useCallback((_: number, newSizes: number[]) => {
    setSizes(newSizes)
  }, [setSizes])

  return (
    <div className="
        flex
        flex-row
        overflow-hidden
        flex-1
        ">
      <Splitter
        minWidths={[400, 380]}
        gutterTheme={GutterTheme.Light}
        initialSizes={sizes}
        classes={['flex', 'flex']}
        onResizeFinished={handleResize}
        gutterClassName='bg-slate-200'
        draggerClassName='bg-slate-400'
      >
        <div className="
          flex
          flex-col
          flex-1
        ">
          <Routes
            routes={routes}
            selectRoute={setSelectedRouteID}
            selectedRouteID={selectedRoute?.id}
            deleteRoute={handleDeleteRoute}
          />
          <RouteEditor
            route={selectedRoute}
          />
        </div>
        <Sidebar
          project={project}
          route={selectedRoute}
        />
      </Splitter>
    </div>
  )
}

export default Editor
