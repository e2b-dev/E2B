import { EditorContent } from '@tiptap/react'
import Fuse from 'fuse.js'

import Text from 'components/Text'
import useDocEditor from 'hooks/useDocEditor'
import { Reference } from 'editor/referenceType'
import { PromptPart, SelectedModel } from 'state/store'
import { useCallback } from 'react'
import { useStateStore } from 'state/StoreProvider'

export interface Props {
  title?: string
  placeholder?: string
  onChange?: (value: string) => void
  content: string
  referenceSearch?: Fuse<Reference>
  model: SelectedModel
  templateID: string
  idx: number
  promptPart: PromptPart
}

function Editor({
  title,
  idx,
  promptPart,
  templateID,
  model,
  content,
  placeholder,
  referenceSearch,
}: Props) {
  const [selectors] = useStateStore()
  const setPrompt = selectors.use.setPrompt()

  const onChange = useCallback((content: string) => {
    setPrompt(templateID, model.provider, model.name, idx, { content, role: promptPart.role, type: promptPart.type })
  }, [setPrompt, templateID, model.provider, model.name, idx, promptPart.role, promptPart.type])


  const editor = useDocEditor({
    initialContent: content,
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
