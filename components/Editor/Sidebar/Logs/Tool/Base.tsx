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
    <div className="
      flex
      flex-col
      items-stretch
      space-y-1
    ">
      <div className="
        flex
        justify-between
        items-center
        pb-2
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

      {body &&
        <div className="
        py-4
        max-w-full
        overflow-x-auto
        scroller
      ">
          {body}
        </div>
      }

      {log.tool_output?.trim() &&
        <div className="
          border-t
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