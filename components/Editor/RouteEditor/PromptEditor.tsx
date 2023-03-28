import { EditorContent } from '@tiptap/react'

import Text from 'components/Text'
import { Block } from 'state/store'
import useDocEditor from 'hooks/useDocEditor'

export interface Props {
  title?: string
  placeholder?: string
  onChange: (value: string) => void
  block: Block
}

function PromptEditor({
  title,
  onChange,
  block,
  placeholder,
}: Props) {
  const editor = useDocEditor({
    initialContent: block.content,
    onContentChange: onChange,
    placeholder,
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
          className="font-semibold text-slate-400"
          size={Text.size.S1}
          text={title}
        />
      }
      <EditorContent
        editor={editor}
        className="
          flex-1
          flex
          w-[65ch]
          flex-col
        "
      />
    </div>
  )
}

export default PromptEditor
