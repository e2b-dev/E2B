'use client'
import { CopyIcon } from 'lucide-react'

interface Props {
  apiKey: string;
}

function APIKey({ apiKey }: Props) {
  return (
    <div className="my-4 flex align-bottom justify-between w-3/4">
        <div
          className="mr-4 w-full text-center space-x-2 text-gray-200 border-2 rounded-md border-gray-200"
        >
          <span className="p-2 font-semibold">{apiKey}</span>
        </div>
        <CopyIcon
          onClick={() => navigator.clipboard.writeText(apiKey)}
          className="cursor-pointer place-self-center text-gray-200 hover:text-gray-400"
          size={24}
        />
    </div>
  )
}

export default APIKey
