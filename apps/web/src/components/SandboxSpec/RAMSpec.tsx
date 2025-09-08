export interface Props {
  ramPrice: number
  isDefault?: boolean
}

function RAMSpec({ ramPrice }: Props) {
  return (
    <div className="w-full flex flex-col gap-2 items-start justify-start">
      <div className="flex items-center justify-between w-full px-2 bg-brand-500/10 rounded">
        <div className="flex items-center justify-start space-between w-full">
          <span className="text-sm text-white font-bold w-[400px]">RAM</span>
          <span className="text-sm text-white font-bold text-right w-[45px]">
            Plan
          </span>
        </div>
        <span className="text-sm text-white font-bold w-full text-center">
          Costs
        </span>
      </div>

      <div className="flex items-center justify-start w-full">
        <div className="flex flex-col items-sart justify-start">
          <div className="flex items-center justify-between w-full border-b border-white/10">
            {/* Hobby */}
            <div className="flex items-center justify-end py-2 pl-2">
              <div className="flex flex-1 items-center justify-start space-between w-[350px]">
                <span className="text-sm font-mono text-left">512 MiB</span>
                <span className="text-sm font-mono font-semibold text-green-500 text-left ml-1">
                  [default]
                </span>
              </div>
              <span className="text-sm font-mono text-left w-[95px]">
                Hobby / Pro
              </span>
            </div>
          </div>

          {/* Pro */}
          <div className="flex items-center justify-start">
            <div className="flex items-center justify-end py-2 pl-2 w-full">
              <span className="text-sm flex-1 font-mono text-left w-[400px]">
                <b>even</b> value <b>between 128 MiB</b> and <b>8,192 MiB</b>
              </span>
              <span className="text-sm font-mono text-right w-[45px]">Pro</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-2">
          <span className="text-sm font-mono">${ramPrice}/GiB/s</span>
        </div>
      </div>
    </div>
  )
}

export default RAMSpec
