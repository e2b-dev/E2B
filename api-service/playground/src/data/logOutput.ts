import { RealtimeChannel, createClient } from '@supabase/supabase-js'

import { Database } from './supabase'
import { createDeferredPromise } from './createDeferredPromise'

import * as dotenv from 'dotenv'

dotenv.config({
  path: '../../.env',
})

const client = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)


export const projectsTable = 'projects'
export const deploymentsTable = 'deployments'
export const routesTable = 'routes'

function checkForResponse(payloadList: any[]): string | null {
  // Get the last log from the deployment logs.
  const payload = payloadList.length > 0 ? payloadList[payloadList.length - 1] : undefined

  if (!payload) {
    return null
  }

  if (payload.type === 'tool' &&
    (payload.tool_name === 'AskHuman' || payload.tool_name === 'LetHumanChoose') &&
    payload.tool_output
  ) {
    return payload.tool_output
  }
  return null
}

export async function waitForLogOutput({ runID }: { runID: string }) {
  const { resolve, promise } = createDeferredPromise<string>()

  let updateSub: RealtimeChannel | undefined

  try {
    setTimeout(() => {
      resolve('Timeout')
    }, 3600000) // 1 hour

    // Subscribe to the changes in the deployment.
    updateSub = client.channel('any-server')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: deploymentsTable,
          filter: `id=eq.${runID}`,
        }, payload => {
          const response = checkForResponse(payload.new.logs as any)
          console.log('Wait for log output', response)
          if (response) {
            resolve(response)
          }
        })
      .subscribe()

    // We fetch the deployment and check if the response is already there
    // because it may arrive before we subscribed and that would mean the subscribe would never trigger.
    const deployment = await client
      .from(deploymentsTable)
      .select('*')
      .eq('id', runID)
      .single()

    const response = checkForResponse(deployment?.data?.logs as any)

    if (response) {
      resolve(response)
    }
  } catch (err) {
    resolve('Error retrieving log output')
  }
  const response = await promise
  updateSub?.unsubscribe()
  return response
}