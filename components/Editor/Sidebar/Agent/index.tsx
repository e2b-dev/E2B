import { useState } from 'react'
// import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'

import Text from 'components/Text'
import { useTabs } from 'components/Tabs/useTabs'
import Tabs from 'components/Tabs'
// import { Database } from 'db/supabase'
import useModelProviderArgs from 'hooks/useModelProviderArgs'
import { getMissingCreds } from 'state/model'
import { useStateStore } from 'state/StoreProvider'
import Button from 'components/Button'
import { AgentRun, AgentRunState, Step, StepEdit } from 'api-client/AgentRun'

import StepsStream from './StepsStream'
import AgentRunControls from './AgentRunControls'
import RawStepsStream from './RawStepsStream'

const tabsProps = {
  tabs: [
    {
      label: 'Pretty',
      id: 'pretty',
    },
    {
      label: 'Raw',
      id: 'raw',
    },
  ]
}

export interface Props {
  steps?: Step[]
  agentState?: AgentRunState
  run: () => void
  agentRun?: AgentRun
}

function Agent({
  agentState,
  agentRun,
  steps,
  run,
}: Props) {
  const [selectedTab, setSelectedTab] = useState(0)
  // const client = useSupabaseClient<Database>()
  const tabsCss = useTabs(tabsProps)
  const [selectors] = useStateStore()
  const router = useRouter()

  const [creds] = useModelProviderArgs()
  const modelConfig = selectors.use.getSelectedModelConfig()()
  const missingCreds = modelConfig ? getMissingCreds(modelConfig?.provider, creds) : []

  // async function saveAnswer({
  //   logID,
  //   answer,
  //   toolName,
  // }: { logID: string, answer: string, toolName: ToolName }) {
  //   if (!agentRun?.runID) return
  //   if (!logs) return

  //   const modifiedLogs = produce(logs, ls => {
  //     const log = ls.find(l => l.id === logID)
  //     if (log && log.type === LogType.Tool && log.tool_name === toolName) {
  //       log.tool_output = answer
  //     }
  //   })

  //   await client
  //     .from(deploymentsTable)
  //     .update({ logs: modifiedLogs as any })
  //     .eq('id', agentRun.runID)
  //     .single()
  // }

  async function onEdit(edit: StepEdit) {
    if (!steps || !agentRun) return
    const editedSteps = AgentRun.resolveStepsEdit(steps, edit)
    if (!editedSteps) return
    await agentRun.rewriteRunSteps(editedSteps)
  }

  return (
    <div className="
      flex
      flex-col
      bg-slate-50
      flex-1
      overflow-hidden
    ">
      <div className="
        flex
        items-center
        border-b
        py-2
        pr-4
        justify-between
      ">
        <div className="
          flex
          space-x-2
        ">
          <Text
            text="Agent"
            size={Text.size.S2}
            className="
            uppercase
            text-slate-400
            font-semibold
            pl-4
            "
          />

          {process.env.NODE_ENV === 'development' && (
            <Tabs
              {...tabsCss.tabProps}
              selectedTabIndex={selectedTab}
              setSelectedTab={setSelectedTab}
            />
          )}
        </div>
        <div className="
          flex
          space-x-2
        "
        >
          {missingCreds.length > 0 &&
            <>
              <Text
                text={`Missing key "${missingCreds[0][1].label || missingCreds[0][0]}"`}
                size={Text.size.S3}
                className="text-slate-400"
              />
              <Button
                className="whitespace-pre-wrap"
                text="Set keys"
                onClick={() => router.push('/settings')}
              />
            </>
          }
          <AgentRunControls
            disabled={missingCreds.length !== 0}
            run={run}
            agentRun={agentRun}
            agentState={agentState}
          />
        </div>
      </div>
      {!steps &&
        <div
          className="
          self-center
          flex
          flex-1
        "
        >
          <Text
            className="text-slate-400"
            text="No agent run found"
          />
        </div>
      }
      {selectedTab === 0 && steps &&
        <StepsStream
          onEdit={onEdit}
          steps={steps}
          isRunning={agentState === AgentRunState.Running}
        />
      }
      {selectedTab === 1 && steps &&
        <RawStepsStream
          rawOutput={steps.map(s => s.output).join('\n')}
        />
      }
    </div>
  )
}

export default Agent
