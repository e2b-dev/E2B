import { User } from '@supabase/auth-helpers-nextjs'
import { CopyIcon } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'


export interface Props {
  apiKey: string
  user: User
}


export default function Settings({ user, apiKey }: Props) {
  const posthog = usePostHog()

  const copyIcon = <CopyIcon
    onClick={() => onClick()}
    className="cursor-pointer ml-auto text-indigo-400 hover:text-indigo-200"
    size={20}
  />
  const items = [
    { 
      title: 'Email', 
      value: user.email, 
      icon: null, 
      description: null 
    },
    { 
      title: 'API Key', 
      value: apiKey.substring(0, 6) + '*'.repeat(18) + apiKey.substring(apiKey.length - 8), 
      icon: copyIcon, 
      description: 'Using e2b cloud enviroments requires an API Key for every request. You can use the keys below in the e2b SDK library.'
    }
  ]
  const onClick = () => {
    navigator.clipboard.writeText(apiKey)
    posthog?.capture('copied API key')
  }
  return (
    <>
      <div className="lg:w-4/5 align-middle xl:mx-12 xl:flex xl:gap-x-4 xl:px-2">
        <main className=" px-6 xl:flex-auto xl:px-0 py-4 xl:py-10">
          <div className="mx-auto space-y-4 lg:space-y-6">
            <h2 className="text-base font-semibold leading-7 text-white">Profile</h2>
            <dl className="my-4 divide-y divide-gray-100 border-t border-gray-400 text-white leading-6" />

            {items.map(item => (<div key={item.title} className="flex flex-col">
              <h2 className="font-semibold leading-7 text-white">{item.title}</h2>
              {item.description && <p className='mb-2 text-sm'>{item.description}</p>}
              <div className="flex w-full align-middle items-center flex-wrap my-1 px-2 py-1 border-2 border-gray-500 bg-gray-700 rounded-md">
                <div className="text-white">{item.value}</div>
                {item.icon}
              </div>
            </div>))}
            
          </div>
        </main>
      </div>
    </>
  )
}
