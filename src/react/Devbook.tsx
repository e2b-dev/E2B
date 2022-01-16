import { ReactNode } from 'react'
import useDevbook from './useDevbook'
import { Template } from '../core'

export interface Props {
  children: ReactNode
}

function Devbook({
  children
}: Props) {
  const { stderr, stdout, url } = useDevbook({
    template: Template.NextJS,
    code: '',
  })

  return (
    <div>
      {children}
    </div>
  )
}

export default Devbook
