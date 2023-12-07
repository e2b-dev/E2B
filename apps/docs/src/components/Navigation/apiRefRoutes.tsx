import Image from 'next/image'
import logoNode from '@/images/logos/node.svg'
import logoPython from '@/images/logos/python.svg'


export const apiRefRoutes = [
  {
    title: 'Reference',
    links: [
      {
        title: 'Overview',
        href: '/reference',
      }
    ]
  },
  {
    title: 'Python SDK',
    icon: (
      <Image
        src={logoPython}
        alt="Python logo"
        className="h-6 w-6"
        unoptimized
      />
    ),
    links: [
      {
        title: 'Installation',
        href: '/reference/python',
      },
    ],
  },
  {
    title: 'Javascript SDK',
    icon: (
      <Image
        src={logoNode}
        alt="Python logo"
        className="h-6 w-6"
        unoptimized
      />
    ),
    links: [
      {
        title: 'Sandbox',
        href: '/reference/js',
      },
    ],
  },
]
