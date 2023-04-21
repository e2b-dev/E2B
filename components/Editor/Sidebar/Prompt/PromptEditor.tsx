import { EditorContent } from '@tiptap/react'
import Fuse from 'fuse.js'
import { useCallback } from 'react'

import Text from 'components/Text'
import useDocEditor from 'hooks/useDocEditor'
import { Reference } from 'editor/referenceType'
import { useStateStore } from 'state/StoreProvider'
import { ModelConfig } from 'state/store'

export interface Props {
  title?: string
  placeholder?: string
  referenceSearch?: Fuse<Reference>
  modelConfig: ModelConfig
  idx: number
  content: string
}

function Editor({
  title,
  idx,
  placeholder,
  modelConfig,
  content: initialContent,
  referenceSearch,
}: Props) {
  const [selectors] = useStateStore()
  const setModelConfigPrompt = selectors.use.setModelConfigPrompt()

  const onChange = useCallback((content: string) => {
    if (!modelConfig?.name) return
    if (!modelConfig?.provider) return

    setModelConfigPrompt({
      name: modelConfig.name,
      provider: modelConfig.provider,
    }, idx, { content })
  }, [
    setModelConfigPrompt,
    modelConfig?.name,
    modelConfig?.provider,
    idx,
  ])

  const editor = useDocEditor({
    initialContent,
    onContentChange: onChange,
    placeholder,
    referenceSearch,
  })

  return (
    <div className="
      flex
      flex-col
      space-y-2
      self-stretch
      pb-6
      border-b
      border-slate-200
    ">
      {title &&
        <Text
          className="font-bold text-slate-400"
          size={Text.size.S2}
          text={title}
        />
      }
      <EditorContent
        editor={editor}
      />
    </div>
  )
}

export default Editor
