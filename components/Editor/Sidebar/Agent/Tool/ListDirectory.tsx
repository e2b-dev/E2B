import {
  Folder,
} from 'lucide-react'

import { ToolLog } from 'db/types'

import Base from './Base'


export interface Props {
  log: ToolLog
  isRunning?: boolean
}

function ListDirectory({
  log,
  isRunning,
}: Props) {
  const body = log.tool_input.trim()
    ? (
      <div className="
        pt-2
        ">
        <pre>
          {log.tool_input.trim()}
        </pre>
      </div>
    )
    : null


  return (
    <Base
      isRunning={isRunning}
      log={log}
      icon={<Folder size="16px" />}
      body={body}
    />
  )
}

export default ListDirectory
