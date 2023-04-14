import { EditorContent } from '@tiptap/react'
import Fuse from 'fuse.js'

import Text from 'components/Text'
import { Block } from 'state/store'
import useDocEditor from 'hooks/useDocEditor'
import { Reference } from 'editor/referenceType'

export interface Props {
  title?: string
  placeholder?: string
  onChange: (value: string) => void
  block: Block
  referenceSearch: Fuse<Reference>
}

function PromptEditor({
  title,
  onChange,
  block,
  placeholder,
  referenceSearch,
}: Props) {
  const editor = useDocEditor({
    initialContent: block.content,
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

export default PromptEditor
