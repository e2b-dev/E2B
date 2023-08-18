import {
  forwardRef,
  useImperativeHandle,
} from 'react'
import { EditorContent } from '@tiptap/react'
import clsx from 'clsx'

import Text from 'components/Text'
import useDocEditor from 'hooks/useDocEditor'

export interface Props {
  className?: string,
  title?: string
  placeholder?: string
  onChange: (value: string) => void
  content: string
  onFocus?: () => void
}

export interface InstructionsEditorRef {
  setContent: (content: string) => void
}

const InstructionsEditor = forwardRef<InstructionsEditorRef, Props>(function InstructionsEditor({
  className,
  title,
  onChange,
  content,
  onFocus,
  placeholder,
}: Props, ref) {
  const editor = useDocEditor({
    initialContent: content,
    onContentChange: onChange,
    placeholder,
    onFocus,
  })

  useImperativeHandle(ref, () => {
    return {
      setContent(content: string) {
        editor?.commands.setContent(content)
      }
    }
  })

  return (
    <div className={clsx('flex flex-col space-y-2 self-stretch pb-6', 'instructions-editor', className)}>
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
})

export default InstructionsEditor
