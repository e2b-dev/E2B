import { ThoughtLog } from 'db/types'

export interface Props {
  log: ThoughtLog
}

function Thought({
  log,
}: Props) {
  return (
    <div className="
      leading-[24px]
      tracking-normal
      font-sans
      text-sm
      text-slate-500
    ">
      {log.content}
    </div>
  )
}

export default Thought