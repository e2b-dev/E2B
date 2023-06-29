import dynamic from 'next/dynamic'
const ReactJson = dynamic(import('react-json-view'), { ssr: false })

export interface Props {
  log?: any
}

function AgentRunLogDetail({
  log,
}: Props) {

  return (
    <div className="overflow-auto mr-2.5 mb-2.5 p-2 h-full bg-[#1F2437] rounded-md flex flex-col space-y-4 border border-[#6366F1]/50">
      {log && (
        <>
          <div className="flex flex-col space-y-1 w-full">
            <span className="text-sm font-medium text-gray-500">Type</span>
            <span className="text-sm text-gray-200 w-full">{log.type}</span>
          </div>

          <div className="flex flex-col space-y-1 w-full">
            <span className="text-sm font-medium text-gray-500">Message</span>
            <p className="text-sm text-gray-200 w-full prose whitespace-pre-wrap max-w-full">{log.message}</p>
          </div>
          {log.properties &&
            <div className="flex flex-col space-y-1 w-full">
              <span className="text-sm font-medium text-gray-500">Properties</span>
              <ReactJson
                src={log.properties}
                name={null}
                style={{
                  background: 'transparent',
                  display: 'flex',
                  whiteSpace: 'pre-wrap',
                }}
                displayObjectSize={false}
                quotesOnKeys={false}
                sortKeys={true}
                displayDataTypes={false}
                theme="ocean"
                enableClipboard={false}
              />
            </div>
          }
        </>
      )}
    </div >
  )
}

export default AgentRunLogDetail