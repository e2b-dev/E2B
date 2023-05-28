const steps = [
  { name: 'Step 1', href: '#repo', status: 'current' },
  { name: 'Step 2', href: '#instructions', status: 'upcoming' },
  { name: 'Step 3', href: '#keys', status: 'upcoming' },
]

function Steps() {
  return (
    <nav className="flex items-center justify-center" aria-label="Progress">
      <ol role="list" className="ml-8 flex items-center space-x-5">
        <p className="text-gray-400 text-sm font-medium">
          Step {steps.findIndex((step) => step.status === 'current') + 1} of {steps.length}
        </p>
        {steps.map((step) => (
          <li key={step.name}>
            {step.status === 'complete' ? (
              <a href={step.href} className="block h-2.5 w-2.5 rounded-full bg-indigo-500">
                <span className="sr-only">{step.name}</span>
              </a>
            ) : step.status === 'current' ? (
              <a href={step.href} className="relative flex items-center justify-center" aria-current="step">
                <span className="absolute flex h-5 w-5 p-px" aria-hidden="true">
                  <span className="h-full w-full rounded-full bg-indigo-600/30 ring-1 ring-inset ring-indigo-500/20" />
                </span>
                <span className="relative block h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden="true" />
                <span className="sr-only">{step.name}</span>
              </a>
            ) : (
              <a href={step.href} className="block h-2.5 w-2.5 rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-gray-500 transition-all">
                <span className="sr-only">{step.name}</span>
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default Steps