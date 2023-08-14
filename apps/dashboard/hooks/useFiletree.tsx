import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

import { NodeType } from '../filesystem'

export type Node = {
  type: NodeType
  path: string
}

type Listener = (f: Node) => void

export const filetreeContext = createContext<{
  select: (f: Node) => void
  addSelectListener: (l: Listener) => void
  removeSelectListener: (l: Listener) => void
} | undefined>(undefined)

export interface FiletreeProviderProps {
  children: ReactNode
}

export function FiletreeProvider({ children }: FiletreeProviderProps) {
  const [listeners] = useState<((f: Node) => void)[]>([])

  const select = useCallback((f: Node) => {
    for (const l of listeners) {
      l(f)
    }
  }, [listeners])

  const addSelectListener = useCallback((l: Listener) => {
    listeners.push(l)
  }, [listeners])

  const removeSelectListener = useCallback((l: Listener) => {
    const idx = listeners.findIndex(l1 => l1 === l)
    listeners.splice(idx, 1)
  }, [listeners])

  const value = useMemo(() => ({
    select,
    addSelectListener,
    removeSelectListener,
  }), [
    select,
    addSelectListener,
    removeSelectListener,
  ])

  return (
    <filetreeContext.Provider value={value}>
      {children}
    </filetreeContext.Provider>
  )
}

export function useFiletree() {
  const ctx = useContext(filetreeContext)
  if (ctx === undefined) {
    throw new Error('useFiletree must be used within `FileTreeProvider`')
  }
  return ctx
}
