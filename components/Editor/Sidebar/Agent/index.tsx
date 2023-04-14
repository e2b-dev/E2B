import { useState } from 'react'
import { deployment_state, deployments } from '@prisma/client'
import produce from 'immer'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'

import Text from 'components/Text'
import { useTabs } from 'components/Tabs/useTabs'
import Tabs from 'components/Tabs'
import { Log, LogType, ToolName } from 'db/types'
import { Database, Json } from 'db/supabase'
import { deploymentsTable } from 'db/tables'
import useModelProviderArgs from 'hooks/useModelProviderArgs'
import { getMissingCreds } from 'state/model'
import { useStateStore } from 'state/StoreProvider'
import Button from 'components/Button'

import LogStream from './LogStream'
import RunButton from '../RunButton'

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
  deployment?: deployments
  isDeployRequestRunning?: boolean
  deploy: () => void
  deployStatus?: deployment_state | null
  isInitializingDeploy?: boolean
}

function Agent({
  deployment,
  isDeployRequestRunning,
  deploy,
  isInitializingDeploy,
}: Props) {
  const [selectedTab, setSelectedTab] = useState(0)
  const client = useSupabaseClient<Database>()
  const tabsCss = useTabs(tabsProps)
  const [selector] = useStateStore()
  const router = useRouter()

  const [creds] = useModelProviderArgs()
  const model = selector.use.model()
  const missingCreds = getMissingCreds(model.provider, creds)

  async function saveAnswer({
    logID,
    answer,
    toolName,
  }: { logID: string, answer: string, toolName: ToolName }) {
    if (!deployment) return

    const logs = produce(deployment.logs as unknown as Log[], ls => {
      const log = ls.find(l => l.id === logID)
      if (log && log.type === LogType.Tool && log.tool_name === toolName) {
        log.tool_output = answer
      }
    })

    await client.from(deploymentsTable).update({ logs: logs as unknown as Json[] }).eq('id', deployment.id).single()
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
          <RunButton
            disabled={missingCreds.length !== 0}
            deploy={deploy}
            isDeployRequestRunning={isDeployRequestRunning}
            isInitializingDeploy={isInitializingDeploy}
            deployStatus={deployment?.state}
          />
        </div>
      </div>
      {!deployment &&
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
      {selectedTab === 0 && deployment &&
        <LogStream
          logs={deployment.logs as unknown as Log[] | undefined}
          onAnswer={saveAnswer}
          isDeployRequestRunning={isDeployRequestRunning}
        />
      }
      {selectedTab === 1 && deployment &&
        <LogStream
          rawLogs={deployment?.logs_raw}
          isDeployRequestRunning={isDeployRequestRunning}
        />
      }
    </div>
  )
}

export default Agent
