import {
  useEffect,
  useState,
  useRef,
} from 'react';
import { EditorState, EditorView, basicSetup } from '@codemirror/basic-setup';
import { javascript } from '@codemirror/lang-javascript';

import { useDevbook } from '@devbookhq/sdk'

import './App.css';
import Editor from './Editor'

function App() {
  const editorEl = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(`const os = require('os');
console.log('Hostname: ', os.hostname());
console.log(process.env)`);

  const { stderr, stdout, run, isLoading, isReady } = useDevbook({ code, debug: true, env: 'nodejs-v16' });

  function handleRunClick() {
    console.log({code});
    run();
  }

  function handleEditorChange(content: string) {
    setCode(content);
  }

  return (
    <div className="app">
      <button onClick={handleRunClick}>Run</button>
      <Editor
        initialCode={code}
        onChange={handleEditorChange}
      />

      {/*
      {isLoading
        ? <div>Loading...</div>
        : (
          <>
            <div>
              STDOUT
              {stdout.map(s => <p>{s}</p>)}
            </div>
            <div>
              STDERR
              {stderr.map(s => <p>{s}</p>)}
            </div>
        </>
      )}
      */}

    </div>
  );
}

export default App;
