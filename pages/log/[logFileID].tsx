import { useState } from 'react'
import { AgentLogs, LogFile, RawFileLog } from 'utils/agentLogs'
import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { ParsedUrlQuery } from 'querystring'
import clsx from 'clsx'
import Splitter from '@devbookhq/splitter'

import Link from 'next/link'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import {
  SystemPromptLog,
  UserPromptLog,
  AssistantPromptLog,
} from 'utils/agentLogs'
import AgentPromptLogs from 'components/AgentPromptLogs'
import AgentPrompLogDetail from 'components/AgentPromptLogDetail'

interface PathProps extends ParsedUrlQuery {
  logFileID: string
}

export const getServerSideProps: GetServerSideProps<Props, PathProps> = async (ctx) => {
  const logFileID = ctx.params?.logFileID
  if (!logFileID) {
    return {
      redirect: {
        destination: '/?view=logs',
        permanent: false,
      }
    }
  }
  const logFileName = ctx.query['filename'] as string | undefined
  if (!logFileName) {
    console.log('no file specified in the "filename" query string', logFileName)
    return {
      notFound: true,
    }
  }

  const supabase = createServerSupabaseClient(ctx, serverCreds)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return {
      redirect: {
        destination: '/sign',
        permanent: false,
      },
    }
  }

  const user = await prisma.auth_users.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      users_teams: {
        select: {
          teams: {
            include: {
              projects: {
                where: {
                  logs: {
                    some: {
                      id: logFileID,
                    },
                  },
                },
                include: {
                  logs: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const log = user
    ?.users_teams
    .flatMap((ut) => ut.teams)
    .flatMap((t) => t.projects)
    .flatMap((p) => p.logs)
    .find((l) => l.id === logFileID)

  if (!log) {
    return {
      notFound: true,
    }
  }

  const files = log.data

  if (!files) {
    console.log('no files')
    return {
      notFound: true,
    }
  }

  if (!log.data || log.data.length === 0) {
    console.log('no files')
    return {
      notFound: true,
    }
  }

  const file = (log.data as unknown as RawFileLog[])
    .find((f) => f.filename === logFileName)

  if (!file) {
    console.log('file not found', logFileName)
    return {
      notFound: true,
    }
  }

  return {
    props: {
      logFile: {
        name: file.filename,
        content: {
          logs: JSON.parse(file.content),
        },
        relativePath: file.metadata.relativePath,
      }
    }
  }
}

export interface Props {
  logFile: LogFile & { content: AgentLogs }
}

function LogFile({ logFile }: Props) {
  console.log('logFile', logFile)
  const [isResizing, setIsResizing] = useState(false)
  const [sizes, setSizes] = useState([60, 40])
  const [selectedLog, setSelectedLog] = useState<SystemPromptLog | UserPromptLog | AssistantPromptLog>()

  return (
    <main className="overflow-hidden flex flex-col flex-1">
      <header className="flex items-center space-x-2 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <Link
          href="/?view=logs"
        >
          <h1 className="text-2xl font-semibold leading-7 text-[#6366F1]">Log Files</h1>
        </Link>
        <h1 className="text-2xl font-semibold leading-7 text-[#6366F1]">/</h1>
        <h1 className="text-2xl font-semibold leading-7 text-white font-mono">{logFile.name}</h1>
      </header>

      <div className="flex-1 flex items-start justify-start space-x-2 sm:p-6 lg:px-8 overflow-hidden">
        <Splitter
          draggerClassName={clsx(
            'bg-gray-700 group-hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] w-0.5 h-full',
            isResizing && 'bg-[#6366F1]',
          )}
          gutterClassName={clsx(
            'mx-2 bg-transparent hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] px-0.5 rounded-sm group',
            isResizing && 'bg-[#6366F1]',
          )}
          classes={['flex', 'flex']}
          onResizeStarted={() => setIsResizing(true)}
          onResizeFinished={(_, newSizes) => {
            setIsResizing(false)
            setSizes(newSizes)
          }}
          initialSizes={sizes}
        >
          {logFile.name.includes('full_message_history') || logFile.name.includes('current_context') ? (
            <>
              <AgentPromptLogs
                logs={logFile.content.logs}
                onSelected={setSelectedLog}
              />
              <AgentPrompLogDetail
                log={selectedLog}
              />
            </>
          ) : logFile.name.includes('next_action') ? (
            <div />
          ) : (
            <div>
              Unexpected JSON format. Please reach out to the e2b team.
            </div>
          )}
        </Splitter>
      </div>
    </main >
  )
}

export default LogFile
