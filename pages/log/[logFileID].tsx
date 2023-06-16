import { LogFile, AgentLogs } from 'utils/agentLogs'

export interface Props {
  logFile: LogFile
  logs: AgentLogs
}

function LogFile({

}) {
  return (
    <main className="overflow-hidden flex flex-col max-h-full">
      <header className="flex items-center justify-between p-4 sm:p-6 lg:px-8">
        <h1 className="text-2xl font-semibold leading-7 text-white">Logs</h1>
      </header>

    </main>
  )
}

export default LogFile
