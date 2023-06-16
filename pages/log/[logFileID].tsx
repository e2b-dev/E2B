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
