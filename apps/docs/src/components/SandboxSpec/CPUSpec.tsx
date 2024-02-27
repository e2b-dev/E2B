export interface Props {
  cpuVals: number[]
  cpuPrice: number
}

function CPUSpec({
  cpuVals,
  cpuPrice,
}: Props) {
  return (
    <div className="w-full flex flex-col gap-2 items-start justify-start">
      <div className="flex items-center justify-between w-full px-2 bg-brand-500/10 rounded">
        <span className="text-white font-bold">CPUs</span>
        <span className="text-white font-bold">Costs</span>
      </div>

      <div className="flex flex-col items-start justify-start w-full">
        {cpuVals.map((val) => (
          <div
            key={val}
            className="flex items-center justify-between w-full p-2 border-b border-white/10"
          >
            <span className="font-mono text-right">{val}</span>
            <span className="font-mono text-right">${val * cpuPrice}/s</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CPUSpec