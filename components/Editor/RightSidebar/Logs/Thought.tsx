import { ThoughtLog } from 'db/types'

export interface Props {
  log: ThoughtLog
}

function Thought({
  log,
}: Props) {
  return (
    <div className="
      italic
      leading-[21px]
      tracking-normal
      font-sans
      text-xs
      text-slate-400
    ">
      {log.content}
    </div>
  )
}

export default Thought