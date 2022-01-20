import React, {
  useEffect,
  useRef,
  memo,
} from 'react';
import { EditorState, EditorView, basicSetup } from '@codemirror/basic-setup';
import { bracketMatching } from '@codemirror/matchbrackets'
import {
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/closebrackets'
import { commentKeymap } from '@codemirror/comment'
import { indentOnInput } from '@codemirror/language'
import {
  codeFolding,
  foldGutter,
} from '@codemirror/fold'
import {
  keymap,
  drawSelection,
} from '@codemirror/view'
import { foldKeymap } from '@codemirror/fold'
import {
  defaultKeymap,
  indentWithTab,
} from '@codemirror/commands'
import {
  lineNumbers,
  highlightActiveLineGutter,
} from '@codemirror/gutter'
import { classHighlightStyle } from '@codemirror/highlight'
import {
  javascriptLanguage,
} from '@codemirror/lang-javascript'

import './Editor.css';

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
    if (!editorEl.current) return;

    const changeWatcher = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });
    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        basicSetup,
        changeWatcher,
        javascriptLanguage,
        drawSelection(),
        highlightActiveLineGutter(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        classHighlightStyle,
        lineNumbers(),
        codeFolding(),
        foldGutter(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...commentKeymap,
          ...foldKeymap,
          indentWithTab,
          // Override default browser Ctrl/Cmd+S shortcut when a code cell is focused.
          {
            key: 'Mod-s',
            run: () => true,
          },
        ]),
      ],
    });

    const view = new EditorView({ state, parent: editorEl.current });
    return () => {
      view.destroy();
    };
  }, [initialCode, onChange, editorEl]);

  return (
    <div
      className="editor"
      ref={editorEl}
    />
  )
}

export default memo(Editor);
