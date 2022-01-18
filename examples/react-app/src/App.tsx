import {
  useState,
  useCallback,
} from 'react';

import { useDevbook } from '@devbookhq/sdk';
import Splitter from '@devbookhq/splitter';

import './App.css';
import Editor from './Editor';
import Output from './Output';


const initialCode = `const os = require('os');
console.log('Hostname: ', os.hostname());
console.log(process.env)`

function App() {
  const [sizes, setSizes] = useState([50, 50]);
  const [code, setCode] = useState(initialCode);

  const { stderr, stdout, run } = useDevbook({ code, debug: true, env: 'nodejs-v16' });

  const handleEditorChange = useCallback((content: string) => {
    setCode(content);
  }, [setCode])

  return (
    <div className="app">
      <button onClick={run}>Run</button>
      <Splitter
        classes={['editor-wrapper']}
        initialSizes={sizes}
        onResizeFinished={(_, sizes) => {
          setSizes(sizes);
        }}
      >
        <Editor
          initialCode={initialCode}
          onChange={handleEditorChange}
        />
        <Output
          stdout={stdout}
          stderr={stderr}
        />
      </Splitter>
    </div>
  );
}

export default App;
