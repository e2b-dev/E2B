export interface CPUValue {
  value: number
  isDefault?: boolean
  plan: 'Hobby / Pro' | 'Pro'
}

export interface Props {
  cpuVals: CPUValue[]
  cpuPrice: number
}

function CPUSpec({ cpuVals, cpuPrice }: Props) {
  return (
    <div className="w-full flex flex-col gap-2 items-start justify-start">
      <div className="flex items-center justify-between w-full px-2 bg-brand-500/10 rounded">
        <div className="flex items-center justify-start space-between w-full w-[300px]">
          <span className="text-sm flex-1 text-white font-bold">vCPUs</span>
          <span className="text-sm text-white font-bold text-left w-[150px]">
            Plan
          </span>
        </div>
        <span className="text-sm text-white font-bold">Costs</span>
      </div>

      <div className="flex flex-col items-start justify-start w-full">
        {cpuVals.map((cpuVal) => (
          <div
            key={cpuVal.value}
            className="flex items-center justify-between w-full p-2 border-b border-white/10"
          >
            <div className="flex items-center justify-start space-between w-full w-[300px]">
              <div className="flex flex-1 items-center justify-start space-between">
                <span className="text-sm font-mono text-left">
                  {cpuVal.value}
                </span>
                {cpuVal.isDefault && (
                  <span className="text-sm font-mono font-semibold text-green-500 text-left ml-1">
                    [default]
                  </span>
                )}
              </div>
              <span className="text-sm font-mono text-left w-[150px]">
                {cpuVal.plan}
              </span>
            </div>

            <span className="text-sm font-mono text-right">
              ${(cpuVal.value * cpuPrice).toFixed(6)}/s
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CPUSpec
