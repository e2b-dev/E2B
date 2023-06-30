import path from 'path-browserify'

import { log_files } from 'db/prisma'

import { AgentNextActionLog, AgentPromptLogs } from './agentLogs'

function getLastTwoDirsAndFile(fullPath: string): string {
  const fileName = path.basename(fullPath)
  const dirName = path.dirname(fullPath)

  const parts = dirName.split(path.sep)
  const lastTwoDirs = parts.slice(-2).join(path.sep)

  return path.join(lastTwoDirs, fileName)
}

export function formatLogFileContent(logFile: Pick<log_files, 'content' | 'filename' | 'relativePath'>) {
  const relativePath = getLastTwoDirsAndFile(logFile.relativePath)

  // This parsing is very Ssecific to the AutoGPT format.
  const filename = logFile.filename
  if (filename.includes('user_input.txt')
    || filename.includes('summary.txt')
  ) {
    return {
      ...logFile,
      relativePath,
      content: logFile.content as string,
    }
  } else if (filename.includes('next_action')) {
    const parsedFileContent = JSON.parse(logFile.content)
    return {
      ...logFile,
      relativePath,
      content: parsedFileContent as AgentNextActionLog,
    }
  } else if (
    filename.includes('full_message_history')
    || filename.includes('current_context')
    || filename.includes('prompt_summary')
  ) {
    const parsedFileContent = JSON.parse(logFile.content)
    return {
      ...logFile,
      relativePath,
      content: {
        logs: parsedFileContent as AgentPromptLogs,
      },
    }
  } else {
    console.error(`Unexpected log file: ${filename}`)
  }

  const parsedFileContent = JSON.parse(logFile.content)
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
