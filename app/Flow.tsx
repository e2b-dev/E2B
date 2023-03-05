'use client'

import ReactFlow, {
  Controls,
  MiniMap,
  Background,
} from 'reactflow'
import { shallow } from 'zustand/shallow'

import { createStore, State } from '@/state/store'

import 'reactflow/dist/style.css'

const selector = (state: State) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
})

const useStore = createStore(
  [
    {
      id: '1',
      type: 'input',
      data: { label: 'Input' },
      position: { x: 250, y: 25 },
    },

    {
      id: '2',
      data: { label: 'Default' },
      position: { x: 100, y: 125 },
    },
    {
      id: '3',
      type: 'output',
      data: { label: 'Output' },
      position: { x: 250, y: 250 },
    },
  ],
  [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' },
  ]
)

export default function Flow() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useStore(selector, shallow)

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      fitView
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow >
  )
}
