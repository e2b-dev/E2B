import { ThoughtLog } from 'db/types'
import { useMemo } from 'react'

export interface Props {
  log: ThoughtLog
}

function Thought({
  log,
}: Props) {
  const content = useMemo(() => {
    return log.content
      .replaceAll('\nAction:', '')
      .replaceAll('Thought:', '')
      .replaceAll('\nFinal Answer:', '')
      .trim()
  }, [log.content])

  return (
    <div className="
      leading-[24px]
      tracking-normal
      font-sans
      text-sm
      text-slate-500
    ">
      {content}
    </div>
  )
}

export default Thought