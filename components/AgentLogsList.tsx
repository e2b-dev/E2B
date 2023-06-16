import { LogFile } from 'utils/agentLogs'

export interface Props {
  logFiles: LogFile[]
}

function AgentLogsList() {
  return (
    <main className="overflow-hidden flex flex-col max-h-full">
      <header className="flex items-center justify-between p-4 sm:p-6 lg:px-8">
        <h1 className="text-2xl font-semibold leading-7 text-white">Agent Logs</h1>
      </header>


    </main>
  )
}

export default AgentLogsList