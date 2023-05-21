import { useCallback, useRef, useState } from 'react'
import { projects } from '@prisma/client'
import Splitter, { GutterTheme } from '@devbookhq/splitter'
import { useLocalStorage } from 'usehooks-ts'

import Sidebar from './Sidebar'
import SidebarMenu, { MenuSection } from './SidebarMenu'
import Template from './Template'


export interface Props {
  project: projects
}

function Editor({ project }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [selectedMenuSection, setSelectedMenuSection] = useState(
    MenuSection.Run,
  )

  const [sizes, setSizes] = useLocalStorage('project-board-splitter-sizes', [50, 50])
  const handleResize = useCallback((_: number, newSizes: number[]) => {
    setSizes(newSizes)
    if (ref.current) {
      ref.current.style.pointerEvents = 'auto'
    }
  }, [setSizes])

  const onResizeStart = useCallback(() => {
    if (ref.current) {
      ref.current.style.pointerEvents = 'none'
    }
  }, [])

  return (
    <div className="
        flex
        flex-row
        overflow-hidden
        flex-1
        ">
      <Splitter
        minWidths={[400, 380]}
        gutterTheme={GutterTheme.Light}
        initialSizes={sizes}
        classes={['flex', 'flex']}
        onResizeFinished={handleResize}
        onResizeStarted={onResizeStart}
        gutterClassName='bg-slate-200'
        draggerClassName='bg-slate-400'
      >
        {/* <div className="
          flex-1
          flex
          flex-col
        ">
          <div className="
            p-1
            flex
            space-x-1
          ">
            <Button
              text='StripeAgent.py'
              onClick={() => setEditorContent(codeEditorContentStripe.content)}
            />
            <Button
              text='BaseAgent.py'
              onClick={() => setEditorContent(codeEditorContentBase.content)}
            />
          </div>
          <div className="
                  flex-1
                  overflow-hidden
                  relative
          ">

            <CodeEditor
              theme={theme}
              className={`
                absolute
                inset-0
                not-prose
              `}
              content={editorContent}
              // content={codeEditorContentStripe.content}
              // content={codeEditorContentBase.content}
              lintGutter={false}
              filename="main.py"
              supportedLanguages={supportedLanguages}
            />
          </div>
        </div> */}
        <Template />
        <Sidebar
          activeMenuSection={selectedMenuSection as MenuSection}
          project={project}
        />
      </Splitter>
      <SidebarMenu
        selected={selectedMenuSection as MenuSection}
        setSelected={setSelectedMenuSection}
      />
    </div>
  )
}

export default Editor
