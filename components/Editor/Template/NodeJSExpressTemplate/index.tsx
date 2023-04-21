

import RouteEditor from './Instructions'
import Routes from './Routes'
import useRoutes from './useRoutes'

function NodeJSExpressTemplate() {
  const {
    deleteRoute,
    routes,
    updateRoute,
    selectedRoute,
    selectRoute,
  } = useRoutes()

  return (
    <>
      <Routes
        routes={routes}
        selectRoute={selec}
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
