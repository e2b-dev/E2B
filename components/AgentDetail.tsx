import { ChatBubbleLeftEllipsisIcon, TagIcon, UserCircleIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'

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
    <div className="flex flex-1 items-center justify-center">
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {(deployment?.logs as unknown as AgentLogBase[])
            ?.slice()
            .reverse()
            .map((log, idx, logs) => (
              <li key={log.timestamp}>
                <div className="relative pb-8">
                  {idx !== logs.length - 1 ? (
                    <span className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                  ) : null}
                  <div className="relative flex items-start space-x-3">
                    {log.type === 'info' ? (
                      <>
                        <div className="relative">
                          <span className="absolute -bottom-0.5 -right-1 rounded-tl bg-white px-0.5 py-px">
                            <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <div className="text-sm">
                              <a className="font-medium text-gray-900">
                                {log.type}
                              </a>
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-gray-700">
                            <p>{log.message}</p>
                          </div>
                        </div>
                      </>
                    ) : log.type === 'model' ? (
                      <>
                        <div>
                          <div className="relative px-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-8 ring-white">
                              <UserCircleIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 py-1.5">
                          <div className="text-sm text-gray-500">
                            <a className="font-medium text-gray-900">
                              {log.type}
                            </a>{' '}
                            assigned{' '}
                            <a className="font-medium text-gray-900">
                              {/* {log.assigned.name} */}
                            </a>{' '}
                            <span className="whitespace-nowrap">{log.message}</span>
                          </div>
                        </div>
                      </>
                    ) : log.type === 'playground' ? (
                      <>
                        <div>
                          <div className="relative px-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-8 ring-white">
                              <TagIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 py-0">
                          <div className="text-sm leading-8 text-gray-500">
                            <span className="mr-0.5">
                              <a className="font-medium text-gray-900">
                                {log.type}
                              </a>{' '}
                            </span>{' '}
                            <span className="mr-0.5">
                              <a
                                className="inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-xs font-medium text-gray-900 ring-1 ring-inset ring-gray-200"
                              >
                                <svg
                                  className={clsx('h-1.5 w-1.5')}
                                  viewBox="0 0 6 6"
                                  aria-hidden="true"
                                >
                                  <circle cx={3} cy={3} r={3} />
                                </svg>
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
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-8 ring-white">
                              <TagIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 py-0">
                          <div className="text-sm leading-8 text-gray-500">
                            <span className="mr-0.5">
                              <a className="font-medium text-gray-900">
                                {log.type}
                              </a>{' '}
                            </span>{' '}
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
