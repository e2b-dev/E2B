import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import React from 'react'
import { useEffect, useState } from 'react'
import { Sandbox } from '../../../src'
import { waitFor } from '@testing-library/react'

function E2BTest() {
  const [text, setText] = useState<string>()

  useEffect(() => {
    const getText = async () => {
      const sandbox = await Sandbox.create()
      await sandbox.commands.run('echo "Hello World" > hello.txt')
      const content = await sandbox.files.read('hello.txt')
      setText(content)
    }
    getText()
  }, [])

  return <div>{text}</div>
}
test(
  'browser test',
  async () => {
    const { getByText } = render(<E2BTest />)
    await waitFor(
      () => expect.element(getByText('Hello World')).toBeInTheDocument(),
      {
        timeout: 30_000,
      }
    )
  },
  { timeout: 40_000 }
)
