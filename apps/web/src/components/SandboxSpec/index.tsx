import CPUSpec, { CPUValue } from './CPUSpec'
import RAMSpec from './RAMSpec'
import StorageSpec, { StorageValue } from './StorageSpec'

const cpuVals: CPUValue[] = [
  {
    value: 1,
    plan: 'Pro',
  },
  {
    value: 2,
    isDefault: true,
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

const storageValues: StorageValue[] = [
  {
    value: 1,
    plan: 'Hobby',
  },
  {
    value: 5,
    plan: 'Pro',
  },
]

function SandboxSpec() {
  return (
    <div className="w-full flex flex-col gap-6 items-start">
      <div className="w-full flex flex-col gap-4 items-start">
        <h3 className="text-lg font-bold">CPU</h3>
        <CPUSpec cpuVals={cpuVals} cpuPrice={cpuPrice} />
      </div>

      <div className="w-full flex flex-col gap-4 items-start">
        <h3 className="text-lg font-bold">RAM</h3>
        <RAMSpec ramPrice={ramPrice} />
      </div>

      <div className="w-full flex flex-col gap-4 items-start">
        <h3 className="text-lg font-bold">Storage</h3>
        <StorageSpec storageVals={storageValues} />
      </div>
    </div>
  )
}

export default SandboxSpec
