import clsx from 'clsx'
import { Plus } from 'lucide-react'

import { Route } from 'state/store'
import Button from 'components/Button'
import Text from 'components/Text'
import DeleteButton from 'components/DeleteButton'

export interface Props {
  routes: Route[]
  selectRoute: (id: string) => void
  selectedRouteID?: string
  addRoute: () => void
  deleteRoute: (id: string) => void
}

function Routes({
  routes,
  selectedRouteID,
  addRoute,
  deleteRoute,
  selectRoute,
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
      flex-col
      overflow-y-auto
      leading-4
      p-2
      break-words
      whitespace-normal
      space-y-0.5
      ">
          {routes.map(r =>
            <div
              key={r.id}
              className={clsx(`
              flex
              items-center
              justify-between
              hover:text-green-800
              rounded
              px-2
            `,
                {
                  'text-green-800': selectedRouteID === r.id,
                }
              )}
            >
              <button
                onClick={() => selectRoute(r.id)}
              >
                <Text
                  className="font-mono"
                  text={r.method.toUpperCase() + ' ' + r.route}
                />
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
