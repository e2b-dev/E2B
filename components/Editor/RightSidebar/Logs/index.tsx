import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import hljs from 'highlight.js'
import ReactMarkdown from 'react-markdown'

import Text from 'components/Text'
import { useTabs } from 'components/Tabs/useTabs'
import Tabs from 'components/Tabs'
import { Log } from 'db/types'
import ConnectionLine from 'components/Editor/ConnectionLine'

import LogEntry from './LogEntry'

export interface Props {
  logs?: Log[]
  logsRaw?: string
}

function Logs({
  logs,
  logsRaw,
}: Props) {
  const [selectedTab, setSelectedTab] = useState(0)
  const [tabsProps] = useState({
    tabs: [
      {
        label: 'Pretty',
        id: 'pretty',
      },
      {
        label: 'Raw',
        id: 'raw',
      },
    ]
  })
  const ref = useRef<HTMLDivElement>(null)
  const tabsCss = useTabs(tabsProps)

  // useEffect(function highlightCode() {
  //   if (selectedTab === 1) {
  //     hljs.highlightAll()
  //   }
  // }, [logs, selectedTab])


  useEffect(function scrollLogs() {
    if (!ref.current) return
    ref.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="
      max-w-full
      flex
      flex-col
      overflow-hidden
    ">
      <div className="
        flex
        items-center
        justify-between
        border-b
        py-2
        pr-4
      ">
        <Text
          text="Logs"
          size={Text.size.S2}
          className="
            uppercase
            text-slate-400
            font-semibold
            px-4
          "
        />

        {process.env.NODE_ENV === 'development' && (
          <Tabs
            {...tabsCss.tabProps}
            selectedTabIndex={selectedTab}
            setSelectedTab={setSelectedTab}
          />
        )}
      </div>

      <div
        ref={ref}
        className="
          flex-1
          overflow-auto
          text-xs
          tracking-wide
          font-sans
          scroller
          whitespace-pre-wrap
          py-4
          px-2
      ">
        {selectedTab === 0 && logs?.map((l, i, a) =>
          <Fragment key={i}>
            <LogEntry
              log={l}
            />
            {i < a.length - 1 &&
              <div className="flex items-center flex-col">
                <ConnectionLine className="h-4" />
              </div>
            }
          </Fragment>
        )}
        {selectedTab === 1 && (
          <>
            {logsRaw &&
              <ReactMarkdown>
                {logsRaw}
              </ReactMarkdown>
            }
          </>
        )}
        <div ref={ref} />
      </div>
    </div>
  )
}

export default Logs
