'use client'

import { Session } from '@e2b/sdk'
import { useEffect, useState } from 'react'

function Playground() {
  const [playground, setPlayground] = useState(null)
  const [url, setURL] = useState('')

  console.log('process.env', process.env)

  async function initPlayground() {
    const session = await Session.create({
      id: 'Nodejs',
      apiKey: process.env.NEXT_PUBLIC_E2B_API_KEY,
    })
    setURL('https://' + session.getHostname(3000))
    setPlayground(session)
  }

  useEffect(function init() {
    void initPlayground()
  }, [])

  return (
    <div>
      <h2>Playground</h2>
      {url && (
        <iframe
          style={{ width: '100%', height: '400px' }}
          src={url}
        />
      )}
    </div>
  )
}

export default Playground
