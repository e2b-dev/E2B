'use client'

import { Button } from '../Button'

export const DeveloperContent = ({
  apiUrlState,
  billingUrlState,
}: {
  apiUrlState: [string, (value: string) => void]
  billingUrlState: [string, (value: string) => void]
}) => {
  const [apiUrl, setApiUrl] = apiUrlState
  const [billingUrl, setBillingUrl] = billingUrlState

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col h-full">
        <h1 className="font-bold pb-10 text-xl">Developer settings</h1>

        <span className="font-bold text-neutral-300 pb-2">API URL</span>
        <div className="flex w-full items-center space-x-2 pb-4">
          <input
            type="text"
            className="w-1/2 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
          <Button
            variant="desctructive"
            onClick={() => setApiUrl(process.env.NEXT_PUBLIC_API_URL || '')}
          >
            Reset to default
          </Button>
        </div>

        <span className="font-bold text-neutral-300 pb-2">Billing URL</span>
        <div className="flex w-full items-center space-x-2 pb-4">
          <input
            type="text"
            className="w-1/2 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
            value={billingUrl}
            onChange={(e) => setBillingUrl(e.target.value)}
          />
          <Button
            variant="desctructive"
            onClick={() =>
              setBillingUrl(process.env.NEXT_PUBLIC_BILLING_API_URL || '')
            }
          >
            Reset to default
          </Button>
        </div>
      </div>
    </div>
  )
}
