import Ansi from "ansi-to-react"

import { Log } from '.'
import { Fragment } from 'react'

export interface Props {
  logs: Log[]
}

function Logs({ logs }: Props) {
  return (
    <div className="
      flex
      flex-col
      bg-white
      overflow-y-auto
      text-xs
      leading-4
      break-words
      w-[250px]
      whitespace-normal
      space-y-2
      p-4
    ">
      {logs.map((l, i) =>
        <Fragment key={i}>
          <Ansi>
            {l}
          </Ansi>
          <hr />
        </Fragment>
      )}
    </div>
  )
}

export default Logs
