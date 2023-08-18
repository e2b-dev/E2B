import { User } from '@supabase/auth-helpers-nextjs'
import { CopyIcon } from 'lucide-react'
import {usePostHog} from 'posthog-js/react'
import Link from 'next/link'


export interface Props {
  apiKey: string
  user: User
}

export default function Settings({user, apiKey}: Props) {
  const posthog = usePostHog()

  const onClick = () => {
    navigator.clipboard.writeText(apiKey)
    posthog?.capture('copied API key')
  }
  return (
    <>
      <div className="lg:w-3/4 align-middle lg:mx-12 lg:flex lg:gap-x-4 lg:px-2">
        <main className=" px-6 lg:flex-auto lg:px-0 lg:py-10">
          <div className="mx-auto space-y-16 sm:space-y-20 lg:mx-0 lg:max-w-none">
            <div>
              <h2 className="text-base font-semibold leading-7 text-white">Profile</h2>
              <dl className="mt-6 space-y-6 divide-y divide-gray-100 border-t border-gray-200 text-white leading-6">
                <div className="pt-6 sm:flex">
                  <dt className="font-medium text-white sm:w-64 sm:flex-none sm:pr-6">Email</dt>
                  <dd className="mt-1 mr-2 flex justify-end gap-x-6 sm:mt-0 sm:flex-auto">
                    <div className="text-white">{user.email}</div>
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="text-base font-semibold leading-7 text-white">API Key</h2>
              <p className="mt-1 text-sm leading-6 text-gray-300">Use in <Link className="text-indigo-400" href={'https://github.com/e2b-dev/e2b/tree/main/packages/python-sdk'}>e2b SDK</Link>.</p>

              <ul role="list" className="mt-6 divide-y divide-gray-100 border-t border-gray-200 text-sm leading-6">
                <li className="flex justify-between gap-x-6 px-3 py-6">
                  <div className="font-medium text-white">{apiKey.substring(0,6) + '*'.repeat(8) + apiKey.substring(apiKey.length-8)}</div>
                  <CopyIcon
                    onClick={() => onClick()}
                    className="cursor-pointer text-indigo-400 hover:text-indigo-200"
                    size={18}
                  />
                </li>
              </ul>

            </div>
          </div>
        </main>
      </div>
    </>
  )
}
