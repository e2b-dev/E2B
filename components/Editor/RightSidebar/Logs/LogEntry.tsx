

import {
  Code2,
  Package,
  TerminalSquare,
  Wrench,
  Loader,
} from 'lucide-react'
import { ReactMarkdown } from 'react-markdown/lib/react-markdown'

import { Log } from 'db/types'


function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'InstallNPMDependencies':
      return <Package size="16px" />
    case 'RunJavaScriptCode':
      return <Code2 size="16px" />
    case 'CurlJavaScriptServer':
      return <TerminalSquare size="16px" />
    default:
      return <Wrench size="16px" />
  }
}

export interface Props {
  log: Log
}

function LogEntry({ log }: Props) {
  // useEffect(function highlightCode() {
  //   if (log.type === 'tool' && log.name === 'RunJavaScriptCode') {
  //     hljs.highlightAll()
  //   }
  // }, [log])
  return (
    <div className="
      rounded-lg
      p-3
      border
    ">
      {log.type === 'thought' &&
        <div className="
        italic
        text-slate-400
        ">
          <ReactMarkdown>
            {log.content}
          </ReactMarkdown>
        </div>
      }
      {log.type === 'tool' &&
        <>
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
              {getToolIcon(log.name)}
              <div className="font-medium">
                {log.name}
              </div>
            </div>
            {log.output === undefined &&
              <Loader size="16px" className="text-slate-400 animate-spin" />
            }
          </div>
          {log.input.trim() &&
            <div className="
              border-t
              mt-2
              pt-2
            "
            >
              <pre>
                <ReactMarkdown>
                  {log.input}
                </ReactMarkdown>
              </pre>
            </div>
          }
          {log.output?.trim() &&
            <div className="
              border-t
              mt-2
              pt-2
            "
            >
              <ReactMarkdown>
                {log.output}
              </ReactMarkdown>
            </div>
          }
        </>
      }
    </div>
  )
}

export default LogEntry
