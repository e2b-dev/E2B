import {
  useEffect,
  useRef,
  memo,
} from 'react';

import { EditorState, EditorView, basicSetup } from '@codemirror/basic-setup';
import { javascript } from '@codemirror/lang-javascript';

export interface Props {
  initialCode: string
  onChange: (content: string) => void
}

function Editor({
  initialCode,
  onChange,
}: Props) {
  const editorEl = useRef<HTMLDivElement>(null);

  useEffect(function createEditor() {
    if (!editorEl.current)  return;

    const changeWatcher = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });
    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        basicSetup,
        javascript(),
        changeWatcher,
      ],
    });

    const view = new EditorView({ state, parent: editorEl.current });
    return () => {
      view.destroy();
    };
  }, [initialCode, onChange, editorEl.current]);

  return (
    <div
      className="editor"
      ref={editorEl}
    />
  )
}

export default memo(Editor);
