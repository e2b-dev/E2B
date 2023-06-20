import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { nanoid } from 'nanoid'
import path from 'path'

import { prisma, projects, deployments, log_files } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import DashboardHome from 'components/DashboardHome'
import { AgentNextActionLog, AgentPromptLogs, LiteLogUpload } from 'utils/agentLogs'

export interface Props {
  projects: (projects & { log_uploads: LiteLogUpload[], deployments: deployments[] })[]
  defaultProjectID: string
  view: 'deployments' | 'uploads'
}

function getLastTwoDirsAndFile(fullPath: string): string {
  const fileName = path.basename(fullPath)
  const dirName = path.dirname(fullPath)

  const parts = dirName.split(path.sep)
  const lastTwoDirs = parts.slice(-2).join(path.sep)

  return path.join(lastTwoDirs, fileName)
}

function formatLogFileContent(logFile: log_files) {
  const relativePath = getLastTwoDirsAndFile(logFile.relativePath)

  if (logFile.filename.includes('user_input')) {
    return {
      ...logFile,
      relativePath,
      content: logFile.content as string,
    }
  }
  const parsedFileContent = JSON.parse(logFile.content)

  // Specific to AutoGPT
  if (logFile.filename.includes('next_action')) {
    return {
      ...logFile,
      relativePath,
      content: parsedFileContent as AgentNextActionLog,
    }
  }
  if (logFile.filename.includes('full_message_history') || logFile.filename.includes('current_context')) {
    return {
      ...logFile,
      relativePath,
      content: {
        logs: parsedFileContent as AgentPromptLogs,
      },
    }
  }
  return {
    ...logFile,
    relativePath,
    content: {
      ...parsedFileContent,
      logs: parsedFileContent?.context || [],
      context: undefined,
    },
  }
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const defaultNewTeamID = process.env.DEFAULT_NEW_TEAM_ID as string | undefined
  const showUploadedLogs = process.env.NEXT_PUBLIC_SHOW_UPLOADED_LOGS === '1'

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

  const teams = await prisma.teams.findMany({
    where: {
      users_teams: {
        some: {
          user_id: session.user.id,
        }
      }
    },
    select: {
      id: true,
      is_default: true,
      projects: {
        where: {
          is_default: true,
        },
        include: {
          log_uploads: {
            include: {
              log_files: true,
            },
          },
          deployments: {
            include: {
              log_files: true,
            },
          },
        },
      },
    },
  })

  const defaultTeam =
    teams.find(t => t.is_default) ||
    (defaultNewTeamID && await prisma.teams.update({
      where: {
        id: defaultNewTeamID,
      },
      data: {
        users_teams: {
          connectOrCreate: {
            where: {
              user_id_team_id: {
                team_id: defaultNewTeamID,
                user_id: session.user.id,
              },
            },
            create: {
              user_id: session.user.id,
            },
          },
        },
      },
      include: {
        projects: {
          include: {
            log_uploads: {
              include: {
                log_files: true,
              },
            },
            deployments: {
              include: {
                log_files: true,
              },
            },
          },
        },
      },
    })) ||
    await prisma.teams.create({
      include: {
        projects: {
          include: {
            log_uploads: {
              include: {
                log_files: true,
              },
            },
            deployments: {
              include: {
                log_files: true,
              },
            },
          },
        },
      },
      data: {
        id: nanoid(),
        name: session.user.email || session.user.id,
        is_default: true,
        projects: {
          create: {
            name: 'Default Project',
            is_default: true,
          },
        },
        users_teams: {
          create: {
            users: {
              connect: {
                id: session.user.id,
              },
            },
          },
        },
      },
    })

  const defaultProject =
    teams.flatMap(t => t.projects).find(p => p.is_default) ||
    defaultTeam.projects.find(p => p.is_default) ||
    await prisma.projects.create({
      data: {
        id: nanoid(),
        is_default: true,
        name: 'Default Project',
        teams: {
          connect: {
            id: defaultTeam.id,
          },
        },
      },
      include: {
        log_uploads: {
          include: {
            log_files: true,
          },
        },
        deployments: {
          include: {
            log_files: true,
          },
        },
      },
    })




  return {
    props: {
      view: showUploadedLogs ? 'uploads' : 'deployments',
      defaultProjectID: defaultProject.id,
      projects: [
        defaultProject,
        ...teams.flatMap(t => t.projects),
      ]
        .map(p => ({
          ...p,
          log_uploads: p
            .log_uploads
            .map<LiteLogUpload>(u => ({
              ...u,
              log_files: u.log_files.map(formatLogFileContent),
            }))
        }))
    },
  }
}

function Home({ projects, defaultProjectID, view }: Props) {
  return (
    <DashboardHome
      view={view}
      defaultProjectID={defaultProjectID}
      projects={projects}
    />
  )
}

export default Home
