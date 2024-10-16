/* eslint-disable react/jsx-key */
import Link from 'next/link'

export const features = [
  <span>
    <Link href="https://github.com/e2b-dev/e2b" target="_blank" rel="noreferrer noopener">Open-source</Link> sandbox for LLM
  </span>,
  'A full VM environment',
  'No need for orchestration or infrastructure management',
  'Ability to give each user of your AI app their own isolated environment',
  <span>
    <Link href="/docs/getting-started/installation">
      Python & Node.js SDK
    </Link>
    {' '}for controling the sandbox&apos;s{' '}
    <Link href="/docs/sandbox/api/filesystem">
      filesystem
    </Link>
    ,{' '}
    <Link href="/docs/sandbox/api/process">
      processes
    </Link>
    , and more.
  </span>,
  'Support for up to 24h long-running sandbox sessions',
  <span>
    Ability to <Link href="/docs/sandbox/api/upload">upload files</Link> to the sandbox and <Link href="/docs/sandbox/api/download">download files </Link>from the sandbox,
  </span>,
  // "Premade sandbox for the Code Interpreter / Advanced Data Analysis and AI-powered browsers",
]
