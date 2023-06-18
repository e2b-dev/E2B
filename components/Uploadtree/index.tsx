import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { LiteLogUpload } from 'utils/agentLogs'


export interface Props {
  logUploads: LiteLogUpload[]
}

function Uploadtree({
  logUploads,
}: Props) {
  const [openNodes, setOpenNodes] = useState<string[]>([])

  const sortedLogUploads = useMemo(() => {
    return logUploads
      // logUploads sorted by created_at - the newest first
      .sort((a, b) => {
        if (a.created_at > b.created_at) return -1
        if (a.created_at < b.created_at) return 1
        return 0
      })
      // Sort the log_files inside logUploads alphabtetical by relativePath
      .map(logUpload => {
        const sortedLogFiles = logUpload.log_files.sort((a, b) => {
          if (a.relativePath > b.relativePath) return 1
          if (a.relativePath < b.relativePath) return -1
          return 0
        })

        return {
          ...logUpload,
          log_files: sortedLogFiles,
        }
      })
  }, [logUploads])

  useEffect(function uploadsToTree() {
    const tree = sortedLogUploads.map(logUpload => {
      const relativePaths = logUpload.log_files.map(logFile => logFile.relativePath)
      const relativePathsSplit = relativePaths.map(relativePath => relativePath.split('/'))

      const tree = relativePathsSplit.reduce((acc, relativePathSplit) => {
        let currentAcc = acc

        relativePathSplit.forEach((relativePathSplitPart, index) => {
          if (currentAcc[relativePathSplitPart]) {
            currentAcc = currentAcc[relativePathSplitPart]
          } else {
            currentAcc[relativePathSplitPart] = {}
            currentAcc = currentAcc[relativePathSplitPart]
          }

          if (index === relativePathSplit.length - 1) {
            currentAcc = {
              ...currentAcc,
              id: logUpload.id,
              name: relativePathSplitPart,
              children: [],
            }
          }
        })

        return acc
      }, {} as any)


      return tree
    })

    console.log('tree', tree)
  }, [sortedLogUploads])

  return (
    <div className="flex flex-col items-start justify-start">
      {/* <NodeComponent /> */}
    </div>
  )
}

export default Uploadtree