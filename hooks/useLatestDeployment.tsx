import { deployments, projects } from '@prisma/client'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { deploymentsTable } from 'db/tables'
import { useState, useEffect } from 'react'

export function useLatestDeployment(project: projects) {
  const [deployment, setDeployment] = useState<deployments>()
  const client = useSupabaseClient()

  // useEffect(function subscribe() {
  //   const sub = client.channel('any')
  //     .on('postgres_changes',
  //       {
  //         event: 'UPDATE',
  //         schema: 'public',
  //         table: deploymentsTable
  //         filter: `project_id=eq.${project.id}`,
  //       }, payload => {
  //         console.log('Change received!', payload)
  //         setDeployment(payload.new)
  //       })
  //     .subscribe()

  //   return () => {
  //     sub.unsubscribe()
  //   }
  // }, [deployment, client])

  return deployment
}
