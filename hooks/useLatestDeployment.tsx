import { deployments, projects } from '@prisma/client'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useState, useEffect } from 'react'

import { deploymentsTable } from 'db/tables'
import { Database } from 'db/supabase'

export function useLatestDeployment(project: projects) {
  const [initDeployment, setInitDeployment] = useState<deployments>()

  const [deployment, setDeployment] = useState<deployments>()
  const client = useSupabaseClient<Database>()

  useEffect(function init() {
    (async function () {
      const deployment = await client
        .from(deploymentsTable)
        .select('*')
        .eq('project_id', project.id)
        .order('created_at')
        .limit(1)
        .single()

      if (deployment.error) return

      console.log(deployment.data)
      setInitDeployment(deployment.data as unknown as deployments)
    }())
  }, [client, project.id])

  useEffect(function subscribe() {
    const insertSub = client.channel('any')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: deploymentsTable,
          filter: `project_id=eq.${project.id}`,
        }, payload => {
          console.log('Change received!', payload)
          setDeployment(payload.new as deployments)
        })
      .subscribe()
    const updateSub = client.channel('any')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: deploymentsTable,
          filter: `project_id=eq.${project.id}`,
        }, payload => {
          console.log('Change received!', payload)
          setDeployment(payload.new as deployments)
        })
      .subscribe()

    return () => {
      insertSub.unsubscribe()
      updateSub.unsubscribe()
    }
  }, [client, project.id])

  return deployment || initDeployment
}
