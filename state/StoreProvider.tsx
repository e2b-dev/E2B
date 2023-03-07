import {
  PropsWithChildren,
  useContext,
  createContext,
  useMemo
} from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { projects } from '@prisma/client'

import { Database } from 'db/supabase'

import { createStore } from './store'

const storeContext = createContext<ReturnType<typeof createStore> | null>(null)

export interface Props extends PropsWithChildren {
  initialState?: projects
  client: SupabaseClient<Database>
}

export function StoreProvider({
  initialState,
  client,
  children,
}: Props) {
  const store = useMemo(() => createStore(initialState, client), [initialState, client])

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
