import { deployments } from 'db/prisma'

function useFilterRunLogs({
  deployment,
  runID,
}: {
  deployment?: deployments,
  runID: string,
}) {
  if (!deployment) {
    return []
  }

  return deployment.logs.filter((l: any) => l['properties']?.run_id === runID)
}

export default useFilterRunLogs
