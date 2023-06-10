import { Box, Hammer, Cpu, Info } from 'lucide-react'

import { projects } from 'db/prisma'
import useDeployment from 'hooks/useDeployment'

export interface AgentLogBase {
  id: string
  message: string
  timestamp: string
  type: 'info' | 'tool' | 'playground' | 'model'
  properties: {}
}

export interface AgentToolLog extends AgentLogBase {
  type: 'tool'
  properties: {
    tool: 'filesystem' | 'git'
  }
}

export interface AgentModelLog extends AgentLogBase {
  type: 'model'
  properties: {
    model: 'gpt-4'
    prompt: string
    result: string
  }
}

export interface AgentPlaygroundLog extends AgentLogBase {
  type: 'playground'
  properties: {
    playground: string
  }
}

export interface Props {
  project: projects
}

export function AgentDetail({ project }: Props) {
  const deployment = useDeployment(project)
  return (
    <div className="flex flex-1 flex-col justify-center items-center">
      <div>
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-100">
            Agent
          </h3>
        </div>
      </div>
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {(deployment?.logs as unknown as AgentLogBase[])
            ?.slice()
            .reverse()
            .map((log, idx, logs) => (
              <li key={log.timestamp}>
                <div className="relative pb-8">
                  <div>
                    {log.timestamp}
                  </div>
                  {idx !== logs.length - 1 ? (
                    <span className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-white" aria-hidden="true" />
                  ) : null}
                  <div className="relative flex items-start space-x-3">
                    {log.type === 'info' ? (
                      <>
                        <div className="relative px-1">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-8 ring-white">
                            <Info className="h-5 w-5 text-gray-600" aria-hidden="true" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <div className="text-sm">
                              <a className="font-medium text-gray-400">
                                {log.type}
                              </a>{' '}
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            <p>{log.message}</p>
                          </div>
                        </div>
                      </>
                    ) : log.type === 'model' ? (
                      <>
                        <div>
                          <div className="relative px-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-8 ring-white">
                              <Cpu className="h-5 w-5 text-gray-600" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 py-1.5">
                          <div className="text-sm text-gray-600">
                            <a className="font-medium text-gray-400">
                              {log.type}
                            </a>{' '}
                            <span className="whitespace-nowrap">{log.message}</span>
                          </div>
                        </div>
                      </>
                    ) : log.type === 'playground' ? (
                      <>
                        <div>
                          <div className="relative px-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-8 ring-white">
                              <Box className="h-5 w-5 text-gray-600" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 py-0">
                          <div className="text-sm leading-8 text-gray-600">
                            <span className="mr-0.5">
                              <a className="font-medium text-gray-400">
                                {log.type}
                              </a>{' '}
                            </span>
                            <span className="whitespace-nowrap">{log.message}</span>
                          </div>
                        </div>
                      </>
                    ) : log.type === 'tool' ? (
                      <>
                        <div>
                          <div className="relative px-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-8 ring-white">
                              <Hammer className="h-5 w-5 text-gray-600" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 py-0">
                          <div className="text-sm leading-8 text-gray-600">
                            <span className="mr-0.5">
                              <a className="font-medium text-gray-400">
                                {log.type}
                              </a>{' '}
                            </span>
                            <span className="mr-0.5">
                            </span>
                            <span className="whitespace-nowrap">{log.message}</span>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </div>
    </div>
  )
}

export default AgentDetail
