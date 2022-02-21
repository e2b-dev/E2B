import React, {
  useState,
  useCallback,
} from 'react';

import { useDevbook, DevbookStatus } from '@devbookhq/sdk';
import Splitter from '@devbookhq/splitter';

import Editor from './Editor';
import Output from './Output';


interface Props {
  code?: string
}

function App({ code: initialCode = '' }: Props) {
  const [sizes, setSizes] = useState([50, 50]);
  const [code, setCode] = useState(initialCode);

  const { stderr, stdout, runCmd, status, fs } = useDevbook({ debug: true, env: 'nodejs-v16' });

  const handleEditorChange = useCallback((content: string) => {
    setCode(content);
  }, [setCode]);

  const runCode = useCallback(async (code: string) => {
    if (status !== DevbookStatus.Connected) return
    if (!fs) return

    await fs.write('/files/index.js', code)
    runCmd('node "/files/index.js"')
  }, [runCmd, fs, status]);

  return (
    <div className="">
      <button className="run-btn" onClick={() => runCode(code)}>Run</button>
      <Splitter
        classes={['flex', 'flex']}
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
    </div >
  );
}

export default App;
