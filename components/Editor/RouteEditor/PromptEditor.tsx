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
    bg-white
    p-2
    min-w-full
    rounded
    ">
      <EditorContent
        editor={editor}
        className="w-full h-full outline-none"
      />
    </div>
  )
}

export default PromptEditor
