import { EditorContent } from '@tiptap/react'

import { Block } from 'state/store'
import useDocEditor from 'hooks/useDocEditor'

export interface Props {
  onChange: (value: string) => void
  block: Block
}

function PromptEditor({ onChange, block }: Props) {
  const editor = useDocEditor({
    initialContent: block.prompt,
    onContentChange: onChange,
  })

  return (
    <div className="
    flex
    w-full
    h-full
    ">
      <EditorContent
        editor={editor}
        className="
          flex-1
          flex
          flex-col
        "
      />
    </div>
  )
}

export default PromptEditor
