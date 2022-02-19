import React, {
  useState,
  useCallback,
} from 'react';

import { useDevbook } from '@devbookhq/sdk';
import Splitter from '@devbookhq/splitter';

import Editor from './Editor';
import Output from './Output';


interface Props {
  code?: string
}

function App({ code: initialCode = '' }: Props) {
  const [sizes, setSizes] = useState([50, 50]);
  const [code, setCode] = useState(initialCode);

  const { stderr, stdout, runCode } = useDevbook({ debug: true, env: 'nodejs-v16' });

  const handleEditorChange = useCallback((content: string) => {
    setCode(content);
  }, [setCode]);

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
