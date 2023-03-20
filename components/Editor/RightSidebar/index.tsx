import {
  useCallback,
} from 'react'
import { deployment_state } from '@prisma/client'
import Link from 'next/link'

import { Log } from 'db/types'
import { useStateStore } from 'state/StoreProvider'
import Sidebar from 'components/Sidebar'
import Text from 'components/Text'
import Button from 'components/Button'

import DeployButton from './DeployButton'
import Logs from './Logs'

export interface Props {
  logs?: Log[]
  logsRaw?: string
  deploy: () => void
  deployedURL?: string | null
  deployStatus?: deployment_state | null
  isInitializingDeploy?: boolean
}

function RightSidebar({
  logs,
  logsRaw,
  deploy,
  deployedURL,
  deployStatus,
  isInitializingDeploy,
}: Props) {
  const store = useStateStore()

  const envs = store.use.envs()
  const setEnvs = store.use.setEnvs()
  const changeEnv = store.use.changeEnv()

  const handleEnvKeyChange = useCallback((event: any, idx: number) => {
    changeEnv({ key: event.target.value.trim(), value: envs[idx].value }, idx)
  }, [envs, changeEnv])

  const handleEnvValueChange = useCallback((event: any, idx: number) => {
    changeEnv({ key: envs[idx].key, value: event.target.value.trim() }, idx)
  }, [envs, changeEnv])

  const addNewEnv = useCallback(() => {
    setEnvs([...envs, { key: '', value: '' }])
  }, [envs, setEnvs])

  const deleteEnv = useCallback((delIdx: number) => {
    const newEnvs = [...envs.filter((_, idx) => idx !== delIdx)]
    setEnvs(newEnvs)
  }, [envs, setEnvs])


  return (
    <Sidebar
      side={Sidebar.side.Right}
      className="
        flex
        flex-col
        min-h-0
      "
    >
      <div
        className="
        flex
        px-4
        py-2
        justify-start
        border-b
        flex-col
      "
      >
        <div
          className="
            flex
            flex-1
            items-center
            justify-between
          "
        >
          <Text
            text="Latest Deployment"
            className="
              font-semibold
              uppercase
              text-slate-400
            "
            size={Text.size.S2}
          />
          <DeployButton
            deploy={deploy}
            isInitializingDeploy={isInitializingDeploy}
            deployStatus={deployStatus}
          />
        </div>
        {deployedURL &&
          <Link
            href={deployedURL}
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Text
              size={Text.size.S3}
              text={deployedURL.substring('https://'.length)}
            />
          </Link>
        }
        {!deployedURL &&
          <Text
            text="No deployment URL found"
            size={Text.size.S3}
            className="text-slate-400"
          />
        }
      </div>
      <div className="
        max-w-full
        flex
        flex-col
        border-b
        p-4
        space-y-4
      ">
        <Text
          text="Envs"
          size={Text.size.S2}
          className="
            uppercase
            text-slate-400
            font-semibold
          "
        />
        {envs.map((env, idx) =>
          <div
            key={idx}
            className="
              flex
              items-center
              justify-evenly
              space-x-2
            "
          >
            <input
              className="
                flex-1
                p-1.5
                text-xs
                font-mono
                rounded
                border
                outline-none
                focus:border-green-600
              "
              placeholder="KEY"
              value={env.key}
              onChange={event => handleEnvKeyChange(event, idx)}
            />
            <input
              className="
                flex-1
                p-1.5
                text-xs
                font-mono
                rounded
                border
                outline-none
                focus:border-green-600
              "
              placeholder="VALUE"
              value={env.value}
              onChange={event => handleEnvValueChange(event, idx)}
            />
            {envs.length > 1 &&
              <Button
                text="Delete"
                onClick={() => deleteEnv(idx)}
              />
            }
          </div>
        )}
        <Button
          text="Add another"
          onClick={addNewEnv}
        />
      </div>
      <Logs
        logs={logs}
        logsRaw={logsRaw}
      />
    </Sidebar>
  )
}

export default RightSidebar
