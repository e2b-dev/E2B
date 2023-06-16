import { AgentLogs, LogFile, RawFileLog } from 'utils/agentLogs'
import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { ParsedUrlQuery } from 'querystring'


import Link from 'next/link'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'


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

  const file = log.data[0] as any as RawFileLog

  return {
    props: {
      logFile: {
        id: log.id,
        name: file.filename,
        content: JSON.parse(file.content),
      }
    }
  }
}

export interface Props {
  logFile: LogFile & { content: AgentLogs }
}

function LogFile({ logFile }: Props) {
  return (
    <main className="overflow-hidden flex flex-col max-h-full">
      <header className="flex items-center space-x-2 p-4 sm:p-6 lg:px-8">
        <Link
          href="/?view=logs"
        >
          <h1 className="text-2xl font-semibold leading-7 text-[#6366F1]">Log Files</h1>
        </Link>
        <h1 className="text-2xl font-semibold leading-7 text-[#6366F1]">/</h1>
        <h1 className="text-2xl font-semibold leading-7 text-white font-mono">{logFile.name}</h1>
      </header>

      <div className="flex flex-col space-y-4">
        {logFile.content.functions.map(fn => (
          <div key={logFile.id} className="shadow overflow-hidden sm:rounded-md">
            {fn.name}
          </div>
        ))}
      </div>

      <div className="flex flex-col space-y-4">
        {logFile.content.context.map(ctx => (
          <div key={logFile.id} className="shadow overflow-hidden sm:rounded-md">
            {ctx.role}
          </div>
        ))}
      </div>
    </main>
  )
}

export default LogFile
