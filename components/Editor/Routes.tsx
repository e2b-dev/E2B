import clsx from 'clsx'
import { Plus } from 'lucide-react'

import { Route } from 'state/store'
import Button from 'components/Button'
import Sidebar from 'components/Sidebar'
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
    <Sidebar
      side={Sidebar.side.Left}
      className="
        flex-col
        min-h-0
        flex
        "
    >
      <div className="
        flex
        justify-between
        py-2
        px-4
        border-b
      ">
        <Text
          text="Routes"
          className="font-medium"
          size={Text.size.S2}
        />
        <Button
          text="New"
          onClick={addRoute}
          variant={Button.variant.Outline}
          icon={<Plus size="16px" />}
        />
      </div>
      <div className="
      flex
      flex-col
      overflow-y-auto
      leading-4
      px-4
      py-2
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
    </Sidebar>
  )
}

export default Routes
