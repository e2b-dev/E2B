'use client'

import { Button } from '../Button'

const defaultAPIUrl = process.env.NEXT_PUBLIC_API_URL || ''

export const DeveloperContent = ({
  apiUrlState,
}: {
  apiUrlState: [string, (value: string) => void]
}) => {
  const [apiUrl, setApiUrl] = apiUrlState

  function isUrl(url: string) {
    try {
      new URL(url)
      return true
    } catch (e) {
      return false
    }
  }

  function removeApiSubdomain(url: URL): string {
    const hostParts = url.host.split('.')
    if (hostParts.length > 2 && hostParts[0] === 'api') {
      return hostParts.slice(1).join('.')
    }
    return url.host
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col h-full">
        <h1 className="font-bold pb-10 text-xl">Dashboard settings</h1>

        <span className="font-bold text-neutral-300 pb-2">API URL</span>
        <span className="text-sm text-neutral-300 pb-4">
          Set API URL so the dashboard can connect to your E2B Cluster and correctly display running sandboxes and templates.
        </span>

        {apiUrl !== defaultAPIUrl && (
          <div
            className="bg-white/5 border-l-4 border-orange-500/20 text-gray-300 p-4 mb-4 lg:w-1/2 w-full"
            role="alert"
          >
            <h4 className="font-medium pb-2">
              Setting custom API URL in the E2B SDK & CLI
            </h4>
            <div className="text-sm text-gray-400">
              In your environment variables, set the <code>E2B_DOMAIN</code> variable to your
              custom domain:
              <br />
              <pre className="mt-2 w-full bg-neutral-700 px-2 py-1 rounded-md text-brand-300">
                E2B_DOMAIN={
                  isUrl(apiUrl)
                    ? `"${removeApiSubdomain(new URL(apiUrl))}"`
                    : 'Invalid URL'
                }
              </pre>
            </div>
          </div>
        )}

        <div className="flex w-full items-center space-x-2 pb-4">
          <input
            type="text"
            className="w-1/2 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
          <Button
            variant="desctructive"
            onClick={() => setApiUrl(defaultAPIUrl)}
          >
            Reset to default
          </Button>
        </div>
      </div>
    </div>
  )
}
