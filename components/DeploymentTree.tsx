import { useCallback } from 'react'

import Filesystem, { FileInfo } from 'components/Filesystem'
import { LiteDeployment } from 'utils/agentLogs'
import { FiletreeProvider } from 'hooks/useFiletree'
import RunItem from './RunItem'

export interface Props {
  deployment: LiteDeployment
}

function DeploymentTree({
  deployment,
}: Props) {
  const fetchLogDirContent = useCallback<(dirpath: string) => (FileInfo & { href?: any })[]>(_ => {
    return deployment.log_files.map((f, i, a) => {
      const slug = `${deployment.projects.slug}-run-${a.length - i - 1}`
      return {
        name: f.id,
        timestamp: f.created_at,
        isDir: false,
        id: slug,
        tags: [],
        href: {
          pathname: '/logs/[slug]',
          query: {
            slug,
          },
        },
      }
    })
  }, [deployment])

  return (
    <div className="flex flex-col items-start justify-start">
      <FiletreeProvider>
        <Filesystem
          file={RunItem}
          rootPath='/'
          fetchContent={fetchLogDirContent}
        />
      </FiletreeProvider>
    </div>
  )
}

export default DeploymentTree
