export interface StorageValue {
  value: number
  plan: 'Hobby' | 'Pro'
}

export interface Props {
  storageVals: StorageValue[]
}

function CPUSpec({ storageVals }: Props) {
  return (
    <div className="w-full flex flex-col gap-2 items-start justify-start">
      <div className="flex items-center justify-between w-full px-2 bg-brand-500/10 rounded">
        <div className="flex items-center justify-start space-between w-full w-[300px]">
          <span className="text-sm flex-1 text-white font-bold">Storage</span>
          <span className="text-sm text-white font-bold text-left w-[150px]">
            Plan
          </span>
        </div>
        <span className="text-sm text-white font-bold">Costs</span>
      </div>

      <div className="flex flex-col items-start justify-start w-full">
        {storageVals.map((val) => (
          <div
            key={val.value}
            className="flex items-center justify-between w-full p-2 border-b border-white/10"
          >
            <div className="flex items-center justify-start space-between w-full w-[300px]">
              <span className="text-sm flex-1 font-mono text-left">
                {val.value} GiB
              </span>
              <span className="text-sm font-mono text-left w-[150px]">
                {val.plan}
              </span>
            </div>

            <span className="text-sm font-mono text-right">Free</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CPUSpec
