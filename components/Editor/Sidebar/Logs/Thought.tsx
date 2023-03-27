import { useMemo } from 'react'

import { ThoughtLog } from 'db/types'

export interface Props {
  log: ThoughtLog
}

function Thought({
  log,
}: Props) {
  const content = useMemo(() => {
    return log.content
      .replaceAll('\nAction:', '')
      .replaceAll('Action:', '')
      .replaceAll('Thought:', '')
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