import { api_deployments } from '@prisma/client'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useState, useEffect } from 'react'

export function useDeployment(deployment: api_deployments) {
  const [latest, setLatest] = useState<api_deployments>(deployment)
  const client = useSupabaseClient()

  useEffect(function subscribe() {
    const sub = client.channel('any')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'api_deployments',
          filter: `id=eq.${deployment.id}`,
        }, payload => {
          console.log('Change received!', payload)
          setLatest(l => ({ ...l, code: payload.new.code, logs: payload.new.logs }))
        })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [deployment, client])

  return latest
}
