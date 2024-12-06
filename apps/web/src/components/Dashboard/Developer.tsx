'use client'

import { Button } from '../Button'

const defaultAPIUrl = process.env.NEXT_PUBLIC_API_URL || ''
const defaultBillingUrl = process.env.NEXT_PUBLIC_BILLING_API_URL || ''

export const DeveloperContent = ({
  apiUrlState,
  billingUrlState,
}: {
  apiUrlState: [string, (value: string) => void]
  billingUrlState: [string, (value: string) => void]
}) => {
  const [apiUrl, setApiUrl] = apiUrlState
  const [billingUrl, setBillingUrl] = billingUrlState

  function isUrl(url: string) {
    try {
      new URL(url)
      return true
    } catch (e) {
      return false
    }
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col h-full">
        <h1 className="font-bold pb-10 text-xl">Dashboard settings</h1>

        <span className="font-bold text-neutral-300 pb-2">API URL</span>
        <span className="text-sm text-neutral-300 pb-4">
          Customize E2B Cluster API URL.
        </span>

        {apiUrl !== defaultAPIUrl && (
          <div
            className="bg-white/5 border-l-4 border-orange-500/20 text-gray-300 p-4 mb-4 w-1/2"
            role="alert"
          >
            <h4 className="font-medium pb-2">
              Setting custom API URL in the E2B SDK & CLI
            </h4>
            <div className="text-sm text-gray-400">
              In your environment variables, set E2B_DOMAIN variable to your
              custom domain:
              <br />
              E2B_DOMAIN={isUrl(apiUrl) ? new URL(apiUrl).host : 'Invalid URL'}
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

        <span className="font-bold text-neutral-300 pb-2">Billing URL</span>
        <span className="text-sm text-neutral-300 pb-4">
          Customize E2B Billing API URL.
        </span>
        <div className="flex w-full items-center space-x-2 pb-4">
          <input
            type="text"
            className="w-1/2 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
            value={billingUrl}
            onChange={(e) => setBillingUrl(e.target.value)}
          />
          <Button
            variant="desctructive"
            onClick={() => setBillingUrl(defaultBillingUrl)}
          >
            Reset to default
          </Button>
        </div>
      </div>
    </div>
  )
}
