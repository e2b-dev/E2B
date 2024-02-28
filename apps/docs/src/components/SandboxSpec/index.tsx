import CPUSpec, { CPUValue } from './CPUSpec'
import RAMSpec from './RAMSpec'


const cpuVals: CPUValue[] = [
  {
    value: 1,
    plan: 'Pro',
  },
  {
    value: 2,
    plan: 'Hobby / Pro',
  },
  {
    value: 3,
    plan: 'Pro',
  },
  {
    value: 4,
    plan: 'Pro',
  },
  {
    value: 5,
    plan: 'Pro',
  },
  {
    value: 6,
    plan: 'Pro',
  },
  {
    value: 7,
    plan: 'Pro',
  },
  {
    value: 8,
    plan: 'Pro',
  },
]

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