export interface Props {
  ramPrice: number
}

function RAMSpec({
  ramPrice,
}: Props) {
  return (
    <div className="w-full flex flex-col gap-2 items-start justify-start">
      <div className="flex items-center justify-between w-full px-2 bg-brand-500/10 rounded">
        <span className="text-white font-bold">RAM</span>
        <span className="text-white font-bold">Costs</span>
      </div>

      <div className="flex flex-col items-start justify-start w-full">
        <div
          className="flex items-center justify-between w-full p-2 border-b border-white/10"
        >
          <span className="font-mono text-right"><b>even</b> value <b>between 128 MB</b> and <b>8192 MB</b></span>
          <span className="font-mono text-right">${ramPrice}/GB/s</span>
        </div>
      </div>
    </div>
  )
}

export default RAMSpec