import clsx from 'clsx'
import { Plus } from 'lucide-react'

import Button from 'components/Button'
import Text from 'components/Text'
import Select from 'components/Select'

import { Method, methods, RouteInfo } from './useRoutes'

export interface Props {
  routes: RouteInfo[],
  selectedRoute?: RouteInfo,
  addRoute: (route?: RouteInfo) => void,
  setRoute: (route: Partial<RouteInfo> & Pick<RouteInfo, 'id'>) => void,
  deleteRoute: (id: string) => void,
  selectRoute: (id: string) => void,
}

function Routes({
  routes,
  selectedRoute,
  deleteRoute,
  selectRoute,
  addRoute,
  setRoute,
}: Props) {
  return (
    <div>
      <div
        className="
        flex
        border-b
        space-x-4
        items-center
        px-4
        "
      >
        <Text
          text="Routes"
          className="
          font-semibold
          py-3.5
          uppercase
          text-slate-400
        "
          size={Text.size.S2}
        />
        <Button
          text="New"
          onClick={() => addRoute()}
          variant={Button.variant.Outline}
          icon={<Plus size="16px" />}
          isDisabled={routes.length >= 1}
        />
        <div className="
      flex
      overflow-y-auto
      leading-4
      py-1.5
      px-2
      break-words
      whitespace-normal
      ">
          {routes.map(r =>
            <div
              key={r.Method + r.Path}
              className={clsx(`
              flex
              items-center
              justify-between
              hover:text-green-800
              px-2
            `,
                {
                  'text-green-800 group': selectedRoute?.id === r.id,
                  'text-slate-300': selectedRoute?.id !== r.id,
                }
              )}
            >
              <button
                onClick={() => selectRoute(r.id)}
                className="
                flex
                space-x-1
                "
              >
                <div className="flex items-center space-x-2">
                  <Select
                    direction="left"
                    selectedValue={{ key: r.Method, title: r.Method.toUpperCase() }}
                    values={methods.map(m => ({ key: m, title: m.toUpperCase() }))}
                    onChange={m => setRoute({
                      ...r,
                      Method: m.key as Method,
                    })}
                    isSelected={r.id === selectedRoute?.id}
                  />
                </div>

              </button>
              {/* <DeleteButton
                onDelete={() => deleteRoute(r.id)}
              /> */}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Routes
