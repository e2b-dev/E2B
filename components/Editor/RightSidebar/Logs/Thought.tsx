import { ThoughtLog } from 'db/types'

import ReactMarkdown from 'react-markdown'

export interface Props {
  log: ThoughtLog
}

function Thought({
  log,
}: Props) {
  return (
    <div className="
      italic
      text-slate-400
    ">
      <ReactMarkdown>
        {log.content}
      </ReactMarkdown>
    </div>
  )
}

export default Thought