import Link from 'next/link'
import { useUser } from '@supabase/auth-helpers-react'

import UserPortrait from 'components/UserPortrait'

export interface Props {
}

function Header({ }: Props) {
  const user = useUser()

  return (
    <div className="
        flex
        items-center
        justify-end
        border-b
        bg-white
        border-slate-200
        px-3
        py-1.5
      ">
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