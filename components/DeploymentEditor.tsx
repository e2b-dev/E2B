import ReactFlow, {
  Controls,
  MiniMap,
  Background,
} from 'reactflow'
import { shallow } from 'zustand/shallow'

import { createStore, State } from 'state/store'

import 'reactflow/dist/style.css'
import { api_deployments } from '@prisma/client'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect, useState } from 'react'

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

export interface Props {
  deployment: api_deployments
}


function useDeployment(deployment: api_deployments) {
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
          setLatest(l => ({ ...l, data: payload.new.data }))
        })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [deployment, client])

  return latest
}




export default function DeploymentEditor({ deployment }: Props) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
  } = useStore(selector, shallow)

  const syncedDeployment = useDeployment(deployment)

  console.log(syncedDeployment)

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
      <Controls position="top-right">
      </Controls>
      <Background />
    </ReactFlow >
  )
}
