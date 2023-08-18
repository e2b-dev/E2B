import {
  Fragment,
} from 'react'
import { Listbox, Transition } from '@headlessui/react'
import clsx from 'clsx'
import {
  ChevronsUpDown,
  Check,
  Github,
  Plus,
} from 'lucide-react'

import { GitHubAccount } from 'utils/github'

export interface Props {
  accounts: GitHubAccount[]
  selectedAccount: GitHubAccount | null
  onSelectedAccountChange: (account: GitHubAccount) => void
  onAddGithubAccountClick: () => void
}

function RepoAccountSelect({
  accounts,
  selectedAccount,
  onSelectedAccountChange,
  onAddGithubAccountClick,
}: Props) {
  return (
    <Listbox value={selectedAccount} onChange={onSelectedAccountChange}>
      {({ open }) => (
        <div className="w-full">
          <Listbox.Label className="block text-sm font-medium leading-6 text-gray-400">Account</Listbox.Label>
          <div className="relative mt-2">
            <Listbox.Button
              className={clsx(
                open ? 'ring-gray-300' : 'ring-gray-400',
                'relative w-full cursor-pointer rounded-md bg-transparent py-1.5 pl-3 pr-10 text-left text-gray-100 shadow-sm ring-1 ring-inset hover:ring-gray-300 focus:outline-none sm:text-sm sm:leading-6 transition-all'
              )
              }>
              <div className="flex items-center space-x-2">
                <Github size={14} />
                <span className="block truncate">{selectedAccount?.name}</span>
              </div>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronsUpDown size={16} className="text-gray-400" aria-hidden="true" />
              </span>
            </Listbox.Button>

            <Transition
              show={open}
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options
                className="p-2 absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-800 text-base shadow-lg border border-gray-400 focus:outline-none sm:text-sm"
              >
                {accounts.map((acc) => (
                  <Listbox.Option
                    key={acc.name}
                    className={({ active }) =>
                      clsx(
                        active ? 'bg-gray-700' : '',
                        'rounded-md relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-100'
                      )
                    }
                    value={acc}
                  >
                    {({ selected, active }) => (
                      <div className="flex items-center space-x-2">
                        <Github size={14} />
                        <span className={clsx(selected ? 'font-semibold' : 'font-normal', 'block truncate')}>
                          {acc.name}
                        </span>

                        {selected ? (
                          <span
                            className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-100"
                          >
                            <Check size={16} aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                    )}
                  </Listbox.Option>
                ))}
                <button
                  className="w-full rounded-md flex items-center space-x-2 py-2 px-3 cursor-pointer text-gray-100 hover:bg-gray-700"
                  onClick={onAddGithubAccountClick}
                >
                  <Plus size={14} />
                  <span>Add GitHub Account</span>
                </button>
              </Listbox.Options>
            </Transition>
          </div>
        </div>
      )
      }
    </Listbox >
  )
}

export default RepoAccountSelect