import RouteEditor from './Instructions'
import Routes from './Routes'
import useRoutes from './useRoutes'

function NodeJSExpressTemplate() {
  const {
    deleteRoute,
    routes,
    selectedRoute,
    selectRoute,
    addRoute,
    setRoute,
  } = useRoutes()

  return (
    <>
      <Routes
        routes={routes}
        selectRoute={selectRoute}
        selectedRoute={selectedRoute}
        deleteRoute={deleteRoute}
        setRoute={setRoute}
        addRoute={addRoute}
      />
      <RouteEditor
        setRoute={setRoute}
        route={selectedRoute}
      />
    </>
  )
}

export default NodeJSExpressTemplate
