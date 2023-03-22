import useSWRMutation from 'swr/mutation'
import { Fragment, useEffect, useState } from 'react'
import Hotkeys from 'react-hot-keys'
import { projects } from '@prisma/client'

import { Route, methods, Method } from 'state/store'
import { useStateStore } from 'state/StoreProvider'
import Select from 'components/Select'
import Text from 'components/Text'
import Block from 'components/Block'


import ConnectionLine from './ConnectionLine'
import AddBlockButton from './AddBlockButton'
import RightSidebar from './RightSidebar'
import Routes from './Routes'
import Link from 'next/link'

// TODO: Prod API host
const apiHost = process.env.NODE_ENV === 'development'
  ? 'http://0.0.0.0:5000'
  : 'https://ai-api-service-7d2cl2hooq-uc.a.run.app'

export interface Props {
  project: projects
}

async function handlePostGenerate(url: string, { arg }: {
  arg: {
    projectID: string,
    route: Route,
    envs: { key: string, value: string }[],
  }
}) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      projectID: arg.projectID,
      routeID: arg.route.id,
      blocks: arg.route.blocks,
      method: arg.route.method.toLowerCase(),
      route: arg.route.route,
      envs: arg.envs,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

function Editor({ project }: Props) {
  const store = useStateStore()

  const routes = store.use.routes()
  const addBlock = store.use.addBlock()
  const deleteBlock = store.use.deleteBlock()
  const changeBlock = store.use.changeBlock()
  const deleteRoute = store.use.deleteRoute()
  const changeRoute = store.use.changeRoute()
  const addRoute = store.use.addRoute()
  const envs = store.use.envs()

  const [selectedRouteID, setSelectedRouteID] = useState(() => routes.length > 0 ? routes[0].id : undefined)
  const selectedRoute = routes.find(s => s.id === selectedRouteID)
  const [deploymentURL, setDeploymentURL] = useState<string>()

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

  const [focusedBlock, setFocusedBlock] = useState({ index: 0 })
  const {
    trigger: generate,
    isMutating: isDeployRequestRunning,
  } = useSWRMutation(`${apiHost}/generate`, handlePostGenerate)

  async function deploy() {
    if (!selectedRoute) return
    await generate({
      projectID: project.id,
      route: selectedRoute,
      envs,
    })
  }

  return (
    <Hotkeys
      keyName="command+enter,control+enter,shift+command+enter,shift+control+enter"
      onKeyDown={(s) => {
        if (s === 'command+enter' || s === 'control+enter') {
          if (!selectedRoute) return
          setFocusedBlock(b => {
            if (selectedRoute.blocks.length === 0 || b.index === selectedRoute?.blocks.length - 1) {
              addBlock(selectedRoute.id, 'Basic')
            }
            return { index: b.index + 1 }
          })
        } else if (s === 'shift+command+enter' || s === 'shift+control+enter') {
          setFocusedBlock(b => ({ index: b.index > 0 ? b.index - 1 : b.index }))
        }
      }}
      filter={() => true}
      allowRepeat
    >
      <div className="
        flex
        flex-row
        overflow-hidden
        flex-1
        ">
        <Routes
          routes={routes}
          selectRoute={setSelectedRouteID}
          selectedRouteID={selectedRoute?.id}
          deleteRoute={handleDeleteRoute}
          addRoute={addRoute}
        />
        {selectedRoute &&
          <>
            <div className="
              flex
              flex-1
              p-8
              flex-col
              items-center
              overflow-auto
              scroller
              relative
            ">
              <div className="flex items-center space-x-2">
                <Text
                  text="Incoming"
                  className='font-bold'
                />
                <Select
                  direction="left"
                  selectedValue={{ key: selectedRoute.method, title: selectedRoute.method.toUpperCase() }}
                  values={methods.map(m => ({ key: m, title: m.toUpperCase() }))}
                  onChange={m => changeRoute(selectedRoute.id, { method: m.key as Method })}
                />
                <Text
                  text="Request"
                  className='font-bold'
                />
              </div>
              <div className="
                flex
                flex-col
                items-center
                transition-all
              ">
                {selectedRoute.blocks.map((b, i) =>
                  <Fragment
                    key={b.id}
                  >
                    <ConnectionLine className='h-4' />
                    <Block
                      type={b.type}
                      props={{
                        block: b,
                        onDelete() {
                          deleteBlock(selectedRoute.id, i)
                          setTimeout(() => {
                            if (i <= focusedBlock.index) {
                              setFocusedBlock(b => ({ index: b.index - 1 }))
                            } else {
                              setFocusedBlock(b => ({ index: b.index }))
                            }
                          }, 0)
                        },
                        onChange(b) {
                          changeBlock(selectedRoute.id, i, b)
                        },
                        index: i,
                        focus: focusedBlock,
                        onFocus() { setFocusedBlock({ index: i }) }
                      }}
                    />
                  </Fragment>
                )}
              </div>
              <ConnectionLine className='min-h-[16px]' />
              <AddBlockButton
                addBlock={() => {
                  addBlock(selectedRoute.id, 'Basic')
                  setTimeout(() => setFocusedBlock({ index: selectedRoute.blocks.length }), 0)
                }}
              />
              {deploymentURL &&
                <Link
                  href={deploymentURL}
                  className="
                    mt-6
                    underline
                  "
                  target="_blank" rel="noopener noreferrer"
                >
                  <Text
                    text={deploymentURL.substring('https://'.length)}
                    size={Text.size.S3}
                  />
                </Link>
              }
            </div>
            <RightSidebar
              project={project}
              route={selectedRoute}
              isDeployRequestRunning={isDeployRequestRunning}
              deploy={deploy}
              setDeployURL={setDeploymentURL}
            />
          </>
        }
      </div>
    </Hotkeys>
  )
}

export default Editor
