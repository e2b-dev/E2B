import { AgentLogs, LogFile } from 'utils/agentLogs'
import testLogs from './logfile.json'

export interface Props {
  logFile: LogFile & { content: AgentLogs }
}

function LogFile() {
  const logFile: Props['logFile'] = {
    id: 'test',
    name: 'test.json',
    content: testLogs as any as AgentLogs,
  }

  return (
    <main className="overflow-hidden flex flex-col max-h-full">
      <header className="flex items-center justify-between p-4 sm:p-6 lg:px-8">
        <h1 className="text-2xl font-semibold leading-7 text-white">Logs</h1>
      </header>

    </main>
  )
}

export default LogFile
