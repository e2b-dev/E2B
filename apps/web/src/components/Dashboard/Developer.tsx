'use client'

import { Button } from '../Button'
import { useState } from 'react'

const DEFAULT_DOMAIN = 'e2b.dev'
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || DEFAULT_DOMAIN

export const DeveloperContent = ({
  domainState,
}: {
  domainState: [string, (value: string) => void]
}) => {
  const [domain, setDomain] = domainState
  const [url, setUrl] = useState<string>(domain)

  function isUrl(url: string) {
    try {
      new URL(url)
      return true
    } catch (e) {
      return false
    }
  }

  function changeUrl(url: string) {
    setUrl(url)

    // Add protocol if missing
    let urlWithProtocol: string = url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      urlWithProtocol = `https://${url}`
    }

    if (isUrl(urlWithProtocol)) {
      const domain = new URL(urlWithProtocol).host
      let hostParts = domain.split('.')
      if (hostParts.length > 2 && hostParts[0] === 'api') {
        hostParts = hostParts.slice(1)
      }
      setDomain(hostParts.join('.'))
    }
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col h-full">
        <h1 className="font-bold pb-10 text-xl">Dashboard settings</h1>

        <span className="font-bold text-neutral-300 pb-2">API URL</span>
        <span className="text-sm text-neutral-300 pb-4">
          Set API URL so the dashboard can connect to your E2B Cluster and
          correctly display running sandboxes and templates.
        </span>

        {/* Env var has to be set if the domain is not equal to the default */}
        {domain !== DEFAULT_DOMAIN && (
          <div
            className="bg-white/5 border-l-4 border-orange-500/20 text-gray-300 p-4 mb-4 lg:w-1/2 w-full"
            role="alert"
          >
            <h4 className="font-medium pb-2">
              Setting custom API URL in the E2B SDK & CLI
            </h4>
            <div className="text-sm text-gray-400">
              In your environment variables, set the <code>E2B_DOMAIN</code>{' '}
              variable to your custom domain:
              <br />
              <pre className="mt-2 w-full bg-neutral-700 px-2 py-1 rounded-md text-brand-300">
                E2B_DOMAIN=
                {domain ?? 'Invalid URL'}
              </pre>
            </div>
          </div>
        )}

        <div className="flex w-full items-center space-x-2 pb-4">
          <input
            type="text"
            className="w-1/2 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
            value={url}
            onChange={(e) => changeUrl(e.target.value)}
          />
          <Button variant="desctructive" onClick={() => changeUrl(DOMAIN)}>
            Reset to default
          </Button>
        </div>
      </div>
    </div>
  )
}
