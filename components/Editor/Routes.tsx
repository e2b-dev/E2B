import Link from 'next/link'
import { useRouter } from 'next/router'
import useSWRMutation from 'swr/mutation'

import { Route } from 'state/store'
import Button from 'components/Button'

interface PostRouteBody {
  projectID: string
}

async function handlePostRoute(url: string, { arg }: { arg: PostRouteBody }) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

export interface Props {
  routes: Route[]
  projectID: string
}

function Routes({ routes, projectID }: Props) {
  const router = useRouter()

  const {
    trigger: createRoute,
  } = useSWRMutation('/api/route', handlePostRoute)

  async function handleCreateRoute() {
    await createRoute({
      projectID,
    })
  }

  return (
    <div>
      <Button
        text="New route"
        onClick={handleCreateRoute}
      />
      <div className="
      flex
      flex-col
      overflow-y-auto
      text-xs
      leading-4
      break-words
      w-[250px]
      whitespace-normal
      space-y-2
      p-4
    ">
        {routes.map(r => {
          return <Link
            key={r.id}
            href={{
              pathname: router.pathname,
              query: {
                ...router.query,
                route: r.id,
              }
            }}
            shallow
          >
            <div className="flex space-x-2 font-bold">
              {r.method}
              {r.route}
            </div>
          </Link>
        }
        )}
      </div>
    </div>
  )
}

export default Routes
