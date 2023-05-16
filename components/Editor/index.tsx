import { useCallback, useRef, useState } from 'react'
import { projects } from '@prisma/client'
import Splitter, { GutterTheme } from '@devbookhq/splitter'
import { useLocalStorage } from 'usehooks-ts'
import { CodeEditor } from '@devbookhq/code-editor'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'


import Sidebar from './Sidebar'
import SidebarMenu, { MenuSection } from './SidebarMenu'
import Template from './Template'
import { supportedLanguages } from './languages'
import codeEditorContentStripe from './code-editor-content-stripe-agent.json'
import codeEditorContentBase from './code-editor-content-base-agent.json'
import Button from 'components/Button'

const gutterHighlightRadius = '8px'

export const transition = {
  transitionProperty: 'background, opacity, color, font-size',
  transitionTimingFunction: 'cubic-bezier(0.64, 0, 0.78, 0)',
  transitionDuration: '320ms',
}


const customTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    paddingRight: '12px',
    paddingLeft: '22px',
    ...transition,
  },
  '.cm-scroller': {
    overflow: 'auto',
    scrollBehavior: 'smooth',
  },
  // Gutter styling
  '.cm-gutters': {
    paddingLeft: '4px',
  },
  '.cm-highlight-gutter-line': {
    color: '#e9edf2',
    background: 'rgb(148 163 184 / 0.55)',
    cursor: 'pointer',
  },
  '.cm-indicate-gutter-line': {
    background: '#384352',
    cursor: 'pointer',
  },
  '.cm-dim-gutter-line': {
    opacity: '0.4;',
  },
  '.cm-lineNumbers .cm-last-gutter-line': {
    borderBottomRightRadius: gutterHighlightRadius,
    borderBottomLeftRadius: gutterHighlightRadius,
  },
  '.cm-lineNumbers .cm-first-gutter-line': {
    borderTopRightRadius: gutterHighlightRadius,
    borderTopLeftRadius: gutterHighlightRadius,
  },
  // Line styling
  '.cm-line': {
    ...transition,
    transitionProperty: 'opacity, color, font-size'
  },
  '.cm-highlight-line': {
    fontSize: '13.25px;',
    cursor: 'pointer',
  },
  '.cm-dim-line': {
    opacity: '0.4',
  },
})

const theme = [oneDark, customTheme]


export interface Props {
  project: projects
}

function Editor({ project }: Props) {
  console.log('project', project)
  const ref = useRef<HTMLDivElement | null>(null)
  // const editorContent = (project.data as any)?.state.templateID === 'StripeCheckout' ? codeEditorContentStripe.content : codeEditorContentBase.content
  const [editorContent, setEditorContent] = useState(codeEditorContentBase.content)

  const [selectedMenuSection, setSelectedMenuSection] = useState(
    MenuSection.Run,
  )

  const [sizes, setSizes] = useLocalStorage('project-board-splitter-sizes', [0, 100 / 3, 100 / 3])
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
        minWidths={[0, 260, 260]}
        gutterTheme={GutterTheme.Light}
        initialSizes={sizes}
        classes={['flex', 'flex', 'flex']}
        onResizeFinished={handleResize}
        onResizeStarted={onResizeStart}
        gutterClassName='bg-slate-200'
        draggerClassName='bg-slate-400'
      >
        <div className="
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
        </div>
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
