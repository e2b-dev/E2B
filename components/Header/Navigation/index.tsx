import { ChevronRight, LayoutGrid } from 'lucide-react'
import { useRouter } from 'next/router'

import HeaderLink from './HeaderLink'
import { projects } from '@prisma/client'

export interface Props {
  project?: projects
}

function Navigation({ project }: Props) {
  const router = useRouter()

  return (
    <div className="flex items-center space-x-2">
      <HeaderLink
        active={router.pathname === '/'}
        href="/"
        title="Agents"
        icon={<LayoutGrid size="18px" />}
      />
      {project && (
        <>
          <ChevronRight
            className="items-center text-slate-200"
            size="16px"
          />
          <HeaderLink
            active={router.pathname === '/[projectID]'}
            href={{
              pathname: '/[projectID]',
              query: {
                projectID: project.id,
              },
            }}
            title={project.name || project.id}
          />
        </>
      )}
    </div>
  )
}

export default Navigation
