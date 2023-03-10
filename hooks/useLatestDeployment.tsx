import { deployments, projects } from '@prisma/client'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useState, useEffect } from 'react'

import { deploymentsTable } from 'db/tables'
import { Database } from 'db/supabase'
import { Route } from 'state/store'

export function useLatestDeployment(project: projects, route?: Route) {
  const [initDeployment, setInitDeployment] = useState<deployments>()

  const [deployment, setDeployment] = useState<deployments>()
  const client = useSupabaseClient<Database>()

  useEffect(function init() {
    if (!route?.id) return

    (async function () {
      const deployment = await client
        .from(deploymentsTable)
        .select('*')
        .eq('project_id', project.id)
        .eq('route_id', route.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (deployment.error) return
      console.log(deployment.data)
      setInitDeployment(deployment.data as unknown as deployments)
    }())
  }, [client, project.id, route?.id])

  useEffect(function subscribe() {
    if (!route?.id) return

    const insertSub = client.channel('any')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: deploymentsTable,
          filter: `project_id=eq.${project.id}`,
        }, payload => {
          if (payload.new.route_id === route.id) {
            setDeployment(payload.new as deployments)
          }
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
          if (payload.new.route_id === route.id) {
            setDeployment(payload.new as deployments)
          }
        })
      .subscribe()

    return () => {
      insertSub.unsubscribe()
      updateSub.unsubscribe()
    }
  }, [
    client,
    project.id,
    route?.id,
  ])

  return deployment || initDeployment
}
