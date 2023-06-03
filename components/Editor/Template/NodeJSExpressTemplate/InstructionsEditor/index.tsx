import { EditorContent } from '@tiptap/react'
import Fuse from 'fuse.js'
import clsx from 'clsx'

import Text from 'components/Text'
import useDocEditor from 'hooks/useDocEditor'
import { Reference } from 'editor/referenceType'

export interface Props {
  className?: string,
  title?: string
  placeholder?: string
  onChange: (value: string) => void
  content: string
  referenceSearch?: Fuse<Reference>
}

function InstructionsEditor({
  className,
  title,
  onChange,
  content,
  placeholder,
  referenceSearch,
}: Props) {
  const editor = useDocEditor({
    initialContent: content,
    onContentChange: onChange,
    placeholder,
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
}

export default InstructionsEditor
