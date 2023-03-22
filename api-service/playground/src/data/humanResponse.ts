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


// # {
//   #     "id": "52b2b157-132f-47c6-be1e-3c203034fdfb",
//   #     "name": "InstallNPMDependencies",
//   #     "type": "tool",
//   #     "input": "\nexpress\n",
//   #     "output": "All dependencies installed",
//   #     "start_at": "2023-03-19 23:49:23.079327",
//   #     "finish_at": "2023-03-19 23:49:26.002323"
//   # },

function checkForResponse(payloadList: any[]): string | null {
  const payload = payloadList.length > 0 ? payloadList[payloadList.length - 1] : undefined

  if (!payload) {
    return null
  }

  if (payload.type === 'tool' && payload.tool_name === 'AskHuman' && payload.output) {
    return payload.output
  }
  return null
}

export async function waitForHumanResponse({ runID }: { runID: string }) {
  const { resolve, promise } = createDeferredPromise<string>()

  let updateSub: RealtimeChannel | undefined

  try {
    setTimeout(() => {
      resolve('Timeout')
    }, 3600000)

    console.log('runID', runID)
    updateSub = client.channel('any-server')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: deploymentsTable,
          filter: `id=eq.${runID}`,
        }, payload => {
          const response = checkForResponse(payload.new.logs as any)
          if (response) {
            resolve(response)
          }
        })
      .subscribe()


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
    resolve('Error retrieving human response')
  } finally {
  }
  const response = await promise
  updateSub?.unsubscribe()
  return response
}
