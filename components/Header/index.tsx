import { projects } from '@prisma/client'

import Navigation from './Navigation'
import { Settings } from 'lucide-react'
import { useRouter } from 'next/router'
import HeaderLink from './Navigation/HeaderLink'

export interface Props {
  project?: projects
}

function Header({ project }: Props) {
  const router = useRouter()

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
      ">
        <HeaderLink
          active={router.pathname === '/settings'}
          href="/settings"
          title="Settings"
          icon={<Settings size="18px" />}
        />
      </div>
    </div>
  )
}

export default Header
