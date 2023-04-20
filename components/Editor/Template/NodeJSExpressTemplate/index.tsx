import { useState, useEffect } from 'react'

import { useStateStore } from 'state/StoreProvider'

import RouteEditor from './Instructions'
import Routes from './Routes'

export interface Props {

}

function NodeJSExpressTemplate({ }: Props) {
  const [selectors] = useStateStore()

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

  return (
    <>
      <Routes
        routes={routes}
        selectRoute={setSelectedRouteID}
        selectedRouteID={selectedRoute?.id}
        deleteRoute={handleDeleteRoute}
      />
      <RouteEditor
        route={selectedRoute}
      />
    </>
  )
}

export default NodeJSExpressTemplate
