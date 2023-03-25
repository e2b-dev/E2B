import useSWRMutation from 'swr/mutation'
import { Fragment, useEffect, useState } from 'react'
import { projects } from '@prisma/client'
import Link from 'next/link'
import Splitter, { SplitDirection, GutterTheme } from '@devbookhq/splitter'

import { Route, methods, Method } from 'state/store'
import { useStateStore } from 'state/StoreProvider'
import Select from 'components/Select'
import Text from 'components/Text'

import ConnectionLine from './Sidebar/Logs/ConnectionLine'
import Sidebar from './Sidebar'
import Routes from './RouteEditor/Routes'
import RequestBodyEditor from './RouteEditor/RequestBodyEditor'
import Tiptap from './RouteEditor/PromptEditor'


export interface Props {
  project: projects
}


function Editor({ project }: Props) {
  const store = useStateStore()

  const routes = store.use.routes()
  const envs = store.use.envs()

  const [selectedRouteID, setSelectedRouteID] = useState(() => routes.length > 0 ? routes[0].id : undefined)
  const selectedRoute = routes.find(s => s.id === selectedRouteID)


  return (
    <div className="
        flex
        flex-row
        overflow-hidden
        flex-1
        ">
      <Splitter
        gutterTheme={GutterTheme.Light}

      >
        <div>EDITOR</div>
        {/* <RouteEditor /> */}
        <Sidebar
          project={project}
          route={selectedRoute}
          isDeployRequestRunning={isDeployRequestRunning}
          deploy={deploy}
          setDeployURL={setDeploymentURL}
        />
      </Splitter>
    </div>
  )
}

export default Editor
