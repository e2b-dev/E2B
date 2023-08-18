import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useState, useEffect, useMemo } from 'react'

import { logsTable } from 'db/tables'
import { Database } from 'db/supabase'
import { LiteDeploymentLog } from 'utils/agentLogs'

function useDeploymentRunLog(initLog: LiteDeploymentLog) {
  const [logContent, setLogContent] = useState<any>()
  const client = useSupabaseClient<Database>()
  const log = useMemo(() => {
    if (!logContent) return initLog
    return {
      ...initLog,
      content: logContent,
    }
  }, [initLog, logContent])

  // Sometimes a large field from realtime server can be missing because of the internal POSTGRES/TOAST workings.
  // We changed the table replication to full with `ALTER TABLE events REPLICA IDENTITY FULL;` to fix this. 
  // https://github.com/supabase/realtime/issues/223 mentioned that we may need to check the `old_record` field of the payload for the actual value,
  // but so far it seems we don't have to.
  useEffect(function subscribe() {
    const updateSub = client.channel('any')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: logsTable,
          filter: `id=eq.${initLog.id}`,
        }, payload => {
          setLogContent(JSON.parse(payload.new.content))
        })
      .subscribe()
    return () => {
      updateSub.unsubscribe()
    }
  }, [
    client,
    initLog.id,
  ])

  return log
}

export default useDeploymentRunLog
