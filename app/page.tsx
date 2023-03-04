import { createStore } from '@/state/store'
import Flow from './Flow'

export default function Home() {
  return (
    <div className="flex flex-1 font-mono">
      <Flow />
    </div>
  )
}
