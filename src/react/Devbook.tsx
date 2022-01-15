import { DevbookRunner } from '../core'

const runner = new DevbookRunner()

const context = runner.initializeDocumentContext({ documentID: 'react' })

export interface Props {
  children?: string | never[]
}

function Devbook({
  children = ''
}: Props) {

  return (
    <div>
      {children}
    </div>
  )
}

export default Devbook
