import Image from 'next/image'

import { Button } from '@/components/Button'
import logoNode from '@/images/logos/node.svg'
import logoPython from '@/images/logos/python.svg'

const libraries = [
  {
    href: 'https://www.npmjs.com/package/e2b',
    name: 'JavaScript & Typescript',
    description:
      'Usable both in Node.js and in the browser. Requires at least Node.js 18.0.',
    logo: logoNode,
  },
  {
    href: 'https://pypi.org/project/e2b',
    name: 'Python',
    description: 'Requires at least Python 3.8.',
    logo: logoPython,
  },
]

export function Libraries() {
  return (
    <div className="xl:max-w-none">
      <div className="not-prose grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:max-w-none xl:grid-cols-3">
        {libraries.map((library) => (
          <div key={library.name} className="flex flex-row-reverse gap-6">
            <div className="flex flex-col flex-auto">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {library.name}
              </h3>
              <p className="flex-1 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {library.description}
              </p>
              <p className="mt-4">
                {/* @ts-ignore */}
                <Button href={library.href} variant="text" arrow="right">
                  Inspect on{' '}
                  {library.name === 'JavaScript & Typescript' ? ' NPM' : 'PyPi'}
                </Button>
              </p>
            </div>
            <Image
              src={library.logo}
              alt=""
              className="h-12 w-12"
              unoptimized
            />
          </div>
        ))}
      </div>
    </div>
  )
}
