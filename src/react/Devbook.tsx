import useDevbook from './useDevbook'
import { Template } from '../core'

export interface Props {
  children?: string | never[]
}

function Devbook({
  children = ''
}: Props) {
  const devbook = useDevbook({ template: Template.NextJS })

  return (
    <div>
      {children}
    </div>
  )
}

export default Devbook
