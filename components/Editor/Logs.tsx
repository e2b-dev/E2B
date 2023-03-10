import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import hljs from 'highlight.js'

import { Log } from '.'
import { Fragment } from 'react'
import Button from 'components/Button'
import Sidebar from 'components/Sidebar'
import Text from 'components/Text'

export interface Props {
  logs?: Log[]
  deploy: () => void
  deployedURL: string
}

function Logs({
  logs,
  deploy,
  deployedURL,
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
      <div className="
        flex
        items-center
        justify-start
        space-x-2
      ">
        <Button
          text="Deploy"
          onClick={deploy}
          variant={Button.variant.Full}
        />
        <a
          href={deployedURL}
          className="
            underline
          "
        >
          <Text
            size={Text.size.S3}
            text={deployedURL.substring('https://'.length)}
          />
        </a>
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
          </Fragment>
        )}
      </div>
    </Sidebar>
  )
}

export default Logs
