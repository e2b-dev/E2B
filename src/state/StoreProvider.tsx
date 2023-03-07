import {
  PropsWithChildren,
  useContext,
  createContext,
  useMemo
} from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { api_deployments } from '@prisma/client'

import { createStore } from './store'
import { Database } from 'src/db/supabase'

const storeContext = createContext<ReturnType<typeof createStore> | null>(null)

export interface Props extends PropsWithChildren {
  deployment?: api_deployments
  client: SupabaseClient<Database>
}

export function StoreProvider({
  deployment,
  client,
  children,
}: Props) {
  const store = useMemo(() => createStore(deployment, client), [deployment, client])

  return (
    <storeContext.Provider value={store}>
      {children}
    </storeContext.Provider>
  )
}

export function getStoreContext() {
  const ctx = useContext(storeContext)

  if (!ctx) {
    throw new Error('getStoreContext must be used inside StoreProvider')
  }
  return ctx
}
