import Select from 'components/Select'
import { Link } from 'lucide-react'
import { Fragment } from 'react'
import { methods, Method } from 'state/store'
import ConnectionLine from '../Sidebar/Logs/ConnectionLine'
import Tiptap from './PromptEditor'
import RequestBodyEditor from './RequestBodyEditor'
import Text from 'components/Text'

export interface Props {

}

function RouteEditor() {


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

  // <Routes
  //   routes={routes}
  //   selectRoute={setSelectedRouteID}
  //   selectedRouteID={selectedRoute?.id}
  //   deleteRoute={handleDeleteRoute}
  //   addRoute={addRoute}
  // />
  return (
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
            <RequestBodyEditor
              block={b}
              onChange={(b) => {
                changeBlock(selectedRoute.id, i, b)
              }}
              index={i}
              focus={focusedBlock}
              onFocus={() => { setFocusedBlock({ index: i }) }}
            />
          </Fragment>
        )}
        <Tiptap />
      </div>
      <ConnectionLine className='min-h-[16px]' />
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
  )
}

export default RouteEditor
