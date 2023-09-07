import { Session } from '@e2b/sdk'
import { useEffect, useState } from 'react'

import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    const logger = {
      debug: console.log,
      info: console.log,
      warn: console.log,
      error: console.log,
    }
    async function getSession() {
      const session = await Session.create({
        id: 'Nodejs',
        apiKey: E2B_API_KEY,
        logger,
      })
      setSession(session)
    }
    getSession()
  }, [])

  return (
    <>
      <h1>E2B React Test</h1>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </>
  )
}

export default App
