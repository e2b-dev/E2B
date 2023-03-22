import { ReactNode } from 'react'
import {
  Loader,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { ToolLog, LogType } from 'db/types'

export interface Props {
  log: ToolLog
  icon: ReactNode
  body: ReactNode
}

function BaseTool({
  icon,
  log,
  body,
}: Props) {
  if (log.type !== LogType.Tool) throw new Error(`'${log.type}': This component supports only logs of type  '${log.type}'`)

  return (
    <div>
      <div className="
        flex
        justify-between
        items-center
      ">
        <div className="
          flex
          items-center
          space-x-2
        ">
          {icon}
          <div className="font-medium">
            {log.tool_name}
          </div>
        </div>
        {log.tool_output === undefined &&
          <Loader
            className="text-slate-400 animate-spin"
            size="16px"
          />
        }
      </div>

      {body}

      {log.tool_output?.trim() &&
        <div className="
          border-t
          mt-2
          pt-2
        ">
          <ReactMarkdown>
            {log.tool_output}
          </ReactMarkdown>
        </div>
      }
    </div>
  )
}

export default BaseTool