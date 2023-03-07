import Link from 'next/link'
import { useUser } from '@supabase/auth-helpers-react'
import { projects } from '@prisma/client'

import UserPortrait from 'components/UserPortrait'

import Navigation from './Navigation'

export interface Props {
  project?: projects
}

function Header({ project }: Props) {
  const user = useUser()

  return (
    <div className="
      flex
      items-center
      justify-between
      border-b
      bg-white
      border-slate-200
      px-3
    ">
      <Navigation project={project} />
      <div className="
        flex
        items-center
        space-x-4
      ">
        <Link
          href={{
            pathname: '/settings',
          }}
        >
          <UserPortrait username={user?.email} />
        </Link>
      </div>
    </div>
  )
}

export default Header
