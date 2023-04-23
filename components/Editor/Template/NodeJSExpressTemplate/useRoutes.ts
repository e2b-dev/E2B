import { nanoid } from 'nanoid'
import { useCallback, useEffect } from 'react'

import { useStateStore } from 'state/StoreProvider'

export enum Method {
  POST = 'post',
  GET = 'get',
  PUT = 'put',
  DELETE = 'delete',
  PATCH = 'patch',
}

export const methods = Object
  .keys(Method)
  .filter(item => isNaN(Number(item)))
  .map(v => v.toLowerCase())

export interface Route {
  id: string
  Method: string
  Path: string
}

export interface RouteInfo extends Route {
  Description: string
  RequestBody: string
  Instructions: string
}

export interface RoutesState {
  Routes?: RouteInfo[]
  selectedRouteID?: string
}

/**
 * This hook is specific to the NodeJSExpress template.
 * 
 * Because the structure of instructions (the text/prompt that user specifies before generating the code with "Run")
 * in each template could be completely different (sometimes you need array of routes, othertime you just need few fields)
 * we let the template specific hooks handle this and expose just an `any` object from `instructions`.
 */
function useRoutes(): {
  routes: RouteInfo[],
  selectedRoute?: RouteInfo,
  addRoute: (route?: RouteInfo) => void,
  setRoute: (route: Partial<RouteInfo> & Pick<RouteInfo, 'id'>) => void,
  deleteRoute: (id: string) => void,
  selectRoute: (id: string) => void,
} {
  const [selectors] = useStateStore()
  const setInstructions = selectors.use.setInstructions()
  const setInstructionTransform = selectors.use.setInstructionTransform()
  const instructions = selectors.use.instructions()

  const routes = instructions?.['Routes'] as RouteInfo[] | undefined
  const selectedRouteID = instructions?.['selectedRouteID'] as string | undefined
  const selectedRouteInfo = routes?.find(r => r.id === selectedRouteID)

  // Define which fields saved in instructions are in XML format and need to be transfomed before constructing prompt
  // Use format from https://github.com/JSONPath-Plus/JSONPath#syntax-through-examples
  useEffect(function setInstructionsTransform() {
    setInstructionTransform('$.Routes[*].[Description, Instructions]', { type: 'xml' })
  }, [setInstructionTransform])

  const selectRoute = useCallback((id: string) => {
    setInstructions<RoutesState>(i => {
      i['selectedRouteID'] = id
    })
  }, [setInstructions])

  const deleteRoute = useCallback((id: string) => {
    setInstructions<RoutesState>(i => {
      if (!i.Routes) return

      const index = i.Routes?.findIndex(r => r.id === id)
      if (index !== -1) i.Routes.splice(index, 1)
    })
  }, [setInstructions])

  const setRoute = useCallback((route: Partial<RouteInfo> & Pick<RouteInfo, 'id'>) => {
    setInstructions<RoutesState>(i => {
      if (!i.Routes) return

      const index = i.Routes?.findIndex(todo => todo.id === route.id)
      if (index !== -1) i.Routes[index] = {
        ...i.Routes[index],
        ...route,
      }
    })
  }, [setInstructions])

  const addRoute = useCallback((route?: RouteInfo) => {
    setInstructions<RoutesState>(i => {
      route = route || {
        id: nanoid(),
        Description: '',
        Instructions: '',
        Method: Method.POST,
        Path: '/',
        RequestBody: '',
      }

      if (!i.Routes) {
        i.Routes = [route]
      } else {
        i.Routes.push(route)
      }
    })
  }, [setInstructions])

  useEffect(function addDefaultRoute() {
    console.log(routes)
    if (routes === undefined || routes?.length === 0) {
      const id = nanoid()
      addRoute()
      selectRoute(id)
    }
  }, [routes, addRoute, selectRoute])

  return {
    routes: routes || [],
    setRoute,
    addRoute,
    deleteRoute,
    selectRoute,
    selectedRoute: selectedRouteInfo,
  }
}

export default useRoutes
