import { EditorContent } from '@tiptap/react'

import useDocEditor from 'hooks/useDocEditor'

export interface Props {
  initialContent: string
  onContentChange: (content: string) => void
}

function PromptEditor({ initialContent, onContentChange }: Props) {
  const editor = useDocEditor({
    initialContent,
    onContentChange,
  })

  return (
    <div className="
    flex
    flex-1
    ">
      <EditorContent editor={editor || null} />
    </div>
  )
}

export default PromptEditor
