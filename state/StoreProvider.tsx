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
import { createSelectors } from './selectors'

type StoreType = ReturnType<typeof createStore>
type SelectorsType = ReturnType<typeof createSelectors<StoreType>>

const storeContext = createContext<SelectorsType | null>(null)

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
  const selectors = createSelectors(store)

  const s = store(selectors.use.changeRoute)
  return (
    <storeContext.Provider value={selectors}>
      {children}
    </storeContext.Provider>
  )
}

export function useStateStore() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const ctx = useContext(storeContext)

  if (!ctx) {
    throw new Error('getStoreContext must be used inside StoreProvider')
  }
  return ctx
}
