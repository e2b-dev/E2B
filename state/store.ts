import {
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeChange,
  applyNodeChanges,
  EdgeChange,
  applyEdgeChanges,
  Connection,
  addEdge,
  Node,
} from 'reactflow'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface State {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
}

export function createStore(nodes: Node[], edges: Edge[]) {
  const immerStore = immer<State>((set) => ({
    nodes,
    edges,
    onNodesChange: (changes: NodeChange[]) =>
      set(state => {
        state.nodes = applyNodeChanges(changes, state.nodes)
      }),
    onEdgesChange: (changes: EdgeChange[]) =>
      set(state => {
        state.edges = applyEdgeChanges(changes, state.edges)
      }),
    onConnect: (connection: Connection) =>
      set(state => {
        state.edges = addEdge(connection, state.edges)
      }),
  }))
  const useStore = create<State, [['zustand/immer', never]]>(immerStore)
  return useStore
}
