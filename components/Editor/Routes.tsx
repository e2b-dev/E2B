import clsx from 'clsx'
import { Plus } from 'lucide-react'

import { Method, methods, Route } from 'state/store'
import Button from 'components/Button'
import Text from 'components/Text'
import DeleteButton from 'components/DeleteButton'
import Select from 'components/Select'
import { useStateStore } from 'state/StoreProvider'

export interface Props {
  routes: Route[]
  selectRoute: (id: string) => void
  selectedRouteID?: string
  deleteRoute: (id: string) => void
}

function Routes({
  routes,
  selectedRouteID,
  deleteRoute,
  selectRoute,
}: Props) {
  const store = useStateStore()

  const addRoute = store.use.addRoute()
  const changeRoute = store.use.changeRoute()

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
          onClick={addRoute}
          variant={Button.variant.Outline}
          icon={<Plus size="16px" />}
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
              key={r.id}
              className={clsx(`
              flex
              items-center
              justify-between
              hover:text-green-800
              px-2
            `,
                {
                  'text-green-800 group': selectedRouteID === r.id,
                  'text-slate-300': selectedRouteID !== r.id,
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
                <Text
                  className="font-mono"
                  text={r.route}
                />
                <div className="flex items-center space-x-2">
                  <Select
                    direction="left"
                    selectedValue={{ key: r.method, title: r.method.toUpperCase() }}
                    values={methods.map(m => ({ key: m, title: m.toUpperCase() }))}
                    onChange={m => changeRoute(r.id, { method: m.key as Method })}
                    isSelected={r.id === selectedRouteID}
                  />
                </div>

              </button>
              <DeleteButton
                onDelete={() => deleteRoute(r.id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Routes
