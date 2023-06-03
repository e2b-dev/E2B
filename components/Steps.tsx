export interface Props {
  steps: { name: string, status: string }[]
}

function Steps({
  steps,
}: Props) {
  const currentName = steps.find(s => s.status === 'current')?.name
  return (
    <div className="px-px w-full flex items-center justify-center">
      <ol role="list" className="w-full flex items-center space-x-5 mr-1 mt-0.5">
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-medium text-white">{currentName}</span>
          <p className="text-gray-400 text-xs font-medium">
            Step {steps.findIndex((step) => step.status === 'current') + 1} of {steps.length}
          </p>
        </div>
        {steps.map((step) => (
          <li key={step.name}>
            {step.status === 'complete' ? (
              <div className="block h-2.5 w-2.5 rounded-full bg-indigo-500">
                <span className="sr-only">{step.name}</span>
              </div>
            ) : step.status === 'current' ? (
              <div className="relative flex items-center justify-center">
                <span className="absolute flex h-5 w-5 p-px">
                  <span className="h-full w-full rounded-full bg-indigo-600/30 ring-1 ring-inset ring-indigo-500/20" />
                </span>
                <span className="relative block h-2.5 w-2.5 rounded-full bg-indigo-500" />
                <span className="sr-only">{step.name}</span>
              </div>
            ) : (
              <div className="block h-2.5 w-2.5 rounded-full bg-white/5 ring-1 ring-white/10">
                <span className="sr-only">{step.name}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export default Steps