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
    flex-1
    bg-slate-100
    min-w-full
    ">
      <EditorContent
        editor={editor}
        className="w-full h-full"
      />
    </div>
  )
}

export default PromptEditor
