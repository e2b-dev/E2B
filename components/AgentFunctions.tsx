import {
  useState,
} from 'react'
import clsx from 'clsx'
import {
  ChevronRight,
} from 'lucide-react'
import ReactJson from 'react-json-view'

import { AgentFunction } from 'utils/agentLogs'

export interface Props {
  functions: AgentFunction[]
}
function AgentFunctions({
  functions,
}: Props) {
  const [opened, setOpened] = useState<number[]>([])

  function open(idx: number) {
    setOpened(opened => [...opened, idx])
  }

  function close(idx: number) {
    setOpened(opened => opened.filter(i => i !== idx))
  }

  function toggle(idx: number) {
    if (opened.includes(idx)) {
      close(idx)
    } else {
      open(idx)
    }
  }

  function sortAlphabetically(fns: AgentFunction[]) {
    return fns.sort((a, b) => {
      if (a.name < b.name) {
        return -1
      }
      if (a.name > b.name) {
        return 1
      }

      return 0
    })
  }

  console.log('functions', functions)

  return (
    <div className="flex-1 flex flex-col space-y-2 max-w-full w-full overflow-hidden">
      <h2 className="font-bold text-gray-500">Functions</h2>

      <div className="flex-1 flex flex-col space-y-3 max-w-full w-full overflow-auto">
        {sortAlphabetically([...functions]).map((fn, idx) => (
          <div key={idx} className="flex flex-col space-y-2">
            <div className="group flex items-center space-x-2">
              <div
                className={clsx(
                  'p-1 cursor-pointer hover:bg-gray-700 transition-all rounded-md',
                  opened.includes(idx) && 'bg-gray-700',
                  !opened.includes(idx) && 'bg-gray-800',
                )}
                onClick={() => toggle(idx)}
              >
                <ChevronRight size={15} className={clsx(
                  'text-gray-400',
                  'transition-all',
                  'select-none',
                  opened.includes(idx) && 'rotate-90',
                )} />
              </div>

              <span
                className={clsx(
                  'rounded-md',
                  'py-0.5',
                  'px-2',
                  'hover:bg-[#1F2437]',
                  'transition-all',
                  'w-full',
                  'text-sm',
                  'cursor-pointer',
                  'font-mono',
                  opened.includes(idx) && 'bg-[#1F2437]',
                  opened.includes(idx) && 'font-semibold',
                )}
                onClick={() => toggle(idx)}
              >
                {fn.name}
              </span>
            </div>

            {opened.includes(idx) && (
              <div className="px-[12px] flex items-start space-x-5 w-full">
                <div className="w-px self-stretch border-r border-gray-800 rounded" />
                <div className="flex flex-col space-y-3 w-full">
                  {!fn.description && !fn.parameters && (
                    <span className="text-sm text-gray-300">No description or parameters</span>
                  )}

                  {fn.description && (
                    <div className="flex flex-col space-y-1 w-full">
                      <span className="text-sm font-bold text-gray-400">Description</span>
                      <span className="text-sm text-gray-200 w-full">{fn.description}</span>
                    </div>
                  )}

                  {fn.parameters && (
                    <div className="flex flex-col space-y-1 w-full">
                      <span className="text-sm font-bold text-gray-400">Parameters</span>
                      <div className="rounded-md border border-gray-500 overflow-hidden p-2">
                        <ReactJson
                          src={fn.parameters}
                          theme="pop"
                          name={null}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default AgentFunctions