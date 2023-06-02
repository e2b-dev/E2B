import { XCircle } from 'lucide-react'

export interface Props {
  title: string
  infoItems: string[]
}

function AlertError({
  title,
  infoItems,
}: Props) {
  return (
    <div className="rounded-md bg-red-50 p-4 max-w-full">
      <div className="flex overflow-auto">
        <div className="shrink-0">
          <XCircle className="text-red-400" size={16} aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">{title}</h3>
          <div className="mt-2 text-sm text-red-700">
            <ul role="list" className="list-disc space-y-1 pl-5">
              {infoItems.map(i => <li key={i}>{i}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlertError