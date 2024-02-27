import CPUSpec from './CPUSpec'
import RAMSpec from './RAMSpec'

const cpuVals = [1, 2, 3, 4, 5, 6, 7, 8]
const cpuPrice = 0.000014
const ramPrice = 0.0000045

function SandboxSpec() {
  return (
    <div className="w-full flex flex-col gap-8 items-center">
      <CPUSpec cpuVals={cpuVals} cpuPrice={cpuPrice} />
      <RAMSpec ramPrice={ramPrice} />
    </div>
  )
}

export default SandboxSpec