import { useCallback, useEffect, useRef, useState } from 'react'
import { projects } from '@prisma/client'
import Splitter, { GutterTheme } from '@devbookhq/splitter'
import { useLocalStorage } from 'usehooks-ts'
import { Code, Lock } from 'lucide-react'

import { useStateStore } from 'state/StoreProvider'

import Routes from './Routes'
import Sidebar, { MenuSection } from './Sidebar'
import RouteEditor from './RouteEditor'
import clsx from 'clsx'


const menuIconSize = '18px'
function getMenuSelectionIcon(selection: MenuSection) {
  switch (selection) {
    case MenuSection.Agent:
      return <Code size={menuIconSize} />
    // case MenuSection.Context:
    //   return <Box size={menuIconSize} />
    // case MenuSection.Deploy:
    //   return <Server size={menuIconSize} />
    case MenuSection.Envs:
      return <Lock size={menuIconSize} />
  }
}

export interface Props {
  project: projects
}

function Editor({ project }: Props) {
  const [selectors] = useStateStore()
  const ref = useRef<HTMLDivElement | null>(null)

  const [selectedMenuSection, setSelectedMenuSection] = useState(MenuSection.Agent)

  // TODO: Handle editor state differently so we don't rerender this component on each editor edit.
  const routes = selectors.use.routes()
  const deleteRoute = selectors.use.deleteRoute()

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

  const [sizes, setSizes] = useLocalStorage('project-board-splitter-sizes', [50, 50])
  const handleResize = useCallback((_: number, newSizes: number[]) => {
    setSizes(newSizes)
    if (ref.current) {
      ref.current.style.pointerEvents = 'auto'
    }
  }, [setSizes])

  const onResizeStart = useCallback(() => {
    if (ref.current) {
      ref.current.style.pointerEvents = 'none'
    }
  }, [])

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
        onResizeStarted={onResizeStart}
        gutterClassName='bg-slate-200'
        draggerClassName='bg-slate-400'
      >
        <div
          ref={ref}
          className="
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
          activeMenuSection={selectedMenuSection}
          project={project}
          route={selectedRoute}
        />
      </Splitter>
      <div className="
        w-14
        flex
        py-2
        text-sm
        border-l
        bg-white
        flex-col
        space-y-4
        items-center
      "
      >
        {Object.values(MenuSection).map(m =>
          <button
            key={m}
            className={clsx(`
            hover:text-slate-600
            transition-all
            text-xs
            items-center
            justify-center
            flex
            flex-col
            space-y-1
            `,
              {
                'text-slate-400': selectedMenuSection !== m,
                'text-slate-600': selectedMenuSection === m,
              }
            )}
            onClick={() => setSelectedMenuSection(m)}
          >
            {getMenuSelectionIcon(m)}
            <span>
              {m.toString()}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

export default Editor
