import useDevbook from './useDevbook'
import { Template } from '../core'

export interface Props {
  children?: string | never[]
}

function Devbook({
  children = ''
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
