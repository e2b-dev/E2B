import './App.css';
import { useDevbook } from '@devbookhq/sdk'
import { useState } from 'react';

function App() {
  const [code, setCode] = useState('console.log("4")')

  const { stderr, stdout, run, isLoading, isReady } = useDevbook({ code, debug: true, env: 'nodejs-v16' })

  console.log('stdout', stdout)
  console.log('stderr', stderr)

  return (
    <div className="App">
      <input value={code} onChange={e => setCode(e.target.value)} disabled={isLoading || !isReady}></input>
      <button onClick={run}>Run</button>
      <div>
        STDOUT
        {stdout.map(s => <p>{s}</p>)}
      </div>
      <div>
        STDERR
        {stderr.map(s => <p>{s}</p>)}
      </div>
    </div>
  );
}

export default App;
