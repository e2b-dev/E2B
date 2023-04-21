import { useCallback } from 'react'
import { Instruction } from 'state/instruction'

import { useStateStore } from 'state/StoreProvider'
import { Method } from './Routes'

export interface Route {
  Method: Instruction
  Path: Instruction
}

export interface RouteInfo extends Route {
  Description: Instruction
  RequestBody: Instruction
  Instructions: Instruction
}

function useRoutes(): {
  routes: Route[],
  selectedRoute?: Route,
  updateRoute: (method: Method, path: string, route: Route) => void,
  deleteRoute: (method: Method, path: string) => void,
  selectRoute: (method: Method, path: string) => void,
} {
  const [selectors] = useStateStore()
  const setInstructions = selectors.use.setInstructions()
  const instructions = selectors.use.instructions()

  const routes = instructions['Routes']
  const selectedRoute = instructions['selectedRoute']


  const selectRoute = useCallback((method: Method, path: string) => {
    setInstructions(i => {
      i['selectedRoute'] = {
        
      }
    })

  }, [setInstructions]) 

  return {
    routes,
    updateRoute,
    deleteRoute,
  }
}

export default useRoutes
