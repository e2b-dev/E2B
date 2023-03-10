
import { Route } from 'state/store'
import Button from 'components/Button'
import Sidebar from 'components/Sidebar'
import Text from 'components/Text'
import DeleteButton from 'components/DeleteButton'
import clsx from 'clsx'

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
        p-4
        space-y-4
        "
    >
      <div>
        <Button
          text="New route"
          onClick={addRoute}
          variant={Button.variant.Full}
        />
      </div>
      <div className="
      flex
      flex-col
      overflow-y-auto
      leading-4
      break-words
      whitespace-normal
      space-y-2
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
