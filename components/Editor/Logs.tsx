import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import hljs from 'highlight.js'
// import Ansi from 'ansi-to-react'

import { Log } from '.'
import { Fragment } from 'react'
import Button from 'components/Button'
import Sidebar from 'components/Sidebar'

export interface Props {
  logs?: Log[]
  deploy: () => void
}

function Logs({
  logs,
  deploy,
}: Props) {

  useEffect(function highlightCode() {
    hljs.highlightAll()
  }, [logs])

  return (
    <Sidebar
      side={Sidebar.side.Right}
      className="
        flex-col
        min-h-0
        flex
        p-4
        space-y-4
        "
    >
      <div>
        <Button
          text="Deploy"
          onClick={deploy}
          variant={Button.variant.Full}
        />

      </div>
      <div className="
      max-w-full
      flex
      flex-col
      flex-1
      overflow-y-auto
      text-xs
      leading-4
      break-words
      space-y-2
      ">
        {logs?.map((l, i) =>
          <Fragment key={i}>
            <ReactMarkdown className="
              whitespace-pre-wrap
              max-w-full
            ">
              {l}
            </ReactMarkdown>
            {/* <Ansi>
              {l}
            </Ansi> */}
            {/* <hr /> */}
          </Fragment>
        )}
      </div>
    </Sidebar>
  )
}

export default Logs
