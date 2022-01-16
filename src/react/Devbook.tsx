import { ReactNode } from 'react'

import { Template } from 'src/core'
import useDevbook from './useDevbook'

export interface Props {
  children: ReactNode
  code?: string
}

function Devbook({
  children,
  code = '',
}: Props) {
  const { stderr, stdout, url } = useDevbook({
    template: Template.NextJS,
    code,
  })

  return (
    <div>
      {children}
    </div>
  )
}

export default Devbook
