import { BlockType } from 'state/store'
import Basic, { Props as BaseProps } from './Basic'
import RequestBody, { Props as RequestBodyProps } from './RequestBody'

export interface Props {
  type: BlockType
  props: BaseProps | RequestBodyProps
}

function Block({
  type,
  props,
}: Props) {
  switch (type) {
    case 'Basic':
      return <Basic {...props} />
    case 'RequestBody':
      return <RequestBody {...props} />
    default:
      return <Basic {...props} />
  }
}

export default Block
