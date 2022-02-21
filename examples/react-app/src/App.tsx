import {
  useState,
  useCallback,
  useEffect,
} from 'react';

import {
  useDevbook,
  DevbookStatus,
} from '@devbookhq/sdk';
import Splitter from '@devbookhq/splitter';

import './App.css';
import Editor from './Editor';
import Output from './Output';

const initialCode = `const os = require('os');
console.log('Hostname:', os.hostname());
console.log(process.env)`

const initialCmd =
  `ls -l
`

function App() {
  const [sizes, setSizes] = useState([50, 50]);
  const [code, setCode] = useState(initialCode);
  const [cmd, setCmd] = useState(initialCmd);
  const [execType, setExecType] = useState('code');

  const {
    stderr,
    stdout,
    runCmd,
    status,
    url,
    fs,
  } = useDevbook({ debug: true, env: 'nodejs-v16', port: 3000 });
  console.log({ stdout, stderr, url });

  useEffect(function checkFS() {
    (async () => {
      if (status !== DevbookStatus.Connected) return
      if (!fs) return

      await fs.write('/new/path', '00')
      const content = await fs.get('/new/path')
      console.log({ content })
    })()
  }, [fs, status])

  const handleEditorChange = useCallback((content: string) => {
    if (execType === 'code') {
      setCode(content);
    } else {
      setCmd(content);
    }
  }, [setCode, execType]);

  const run = useCallback(async () => {
    if (status !== DevbookStatus.Connected) return
    if (execType === 'code') {
      if (!fs) return

      await fs.write('/files/index.js', code)
      runCmd('node "/files/index.js"')
    } else {
      runCmd(cmd);
    }
  }, [runCmd, code, cmd, execType, fs, status]);

  return (
    <div className="app">
      {status === DevbookStatus.Disconnected && <div>Status: Disconnected, will start VM</div>}
      {status === DevbookStatus.Connecting && <div>Status: Starting VM...</div>}
      {status === DevbookStatus.Connected && (
        <div className="controls">
          <select className="type" value={execType} onChange={e => setExecType(e.target.value)}>
            <option value="code">Code</option>
            <option value="cmd">Command</option>
          </select>
          <button className="run-btn" onClick={run}>Run</button>
        </div>
      )}

      <Splitter
        classes={['flex', 'flex']}
        initialSizes={sizes}
        onResizeFinished={(_, sizes) => {
          setSizes(sizes);
        }}
      >
        <Editor
          initialCode={execType === 'code' ? initialCode : initialCmd}
          onChange={handleEditorChange}
        />
        <Output
          stdout={stdout}
          stderr={stderr}
        />
      </Splitter>
    </div >
  );
}

export default App;
