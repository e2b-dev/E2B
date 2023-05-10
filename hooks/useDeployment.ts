import { deployments, projects } from '@prisma/client'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useState, useEffect } from 'react'

import { deploymentsTable } from 'db/tables'
import { Database } from 'db/supabase'

function useDeployment(project: projects) {
  const [initDeployment, setInitDeployment] = useState<deployments>()

  const [deployment, setDeployment] = useState<deployments>()
  const client = useSupabaseClient<Database>()

  useEffect(function init() {
    (async function () {
      // TODO: SECURITY - Enable row security for all tables and secure access to deployments.
      const deployment = await client
        .from(deploymentsTable)
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!deployment) return
      if (deployment.error) return
      setInitDeployment(deployment.data as unknown as deployments)
    }())
  }, [client, project.id])

  // Sometimes a large field from realtime server can be missing because of the internal POSTGRES/TOAST workings.
  // We changed the table replication to full with `ALTER TABLE events REPLICA IDENTITY FULL;` to fix this. 
  // https://github.com/supabase/realtime/issues/223 mentioned that we may need to check the `old_record` field of the payload for the actual value,
  // but so far it seems we don't have to.
  useEffect(function subscribe() {
    // TODO: SECURITY - Enable row security for all tables and configure access to deployments.
    const insertSub = client.channel('any')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: deploymentsTable,
          filter: `project_id=eq.${project.id}`,
        }, payload => {
          setDeployment(payload.new as deployments)
        })
      .subscribe()

    return () => {
      insertSub.unsubscribe()
    }
  }, [
    client,
    project.id,
  ])

  return deployment || initDeployment
}

export default useDeployment
