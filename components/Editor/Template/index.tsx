import { forwardRef } from 'react'

import NodeJSExpressTemplate from './NodeJSExpressTemplate'

export interface Props { }

const Template = forwardRef<HTMLDivElement, Props>(({ }, ref) => {
  return (
    <div
      ref={ref}
      className="
      flex
      flex-col
      flex-1
  ">
      <NodeJSExpressTemplate />
    </div>
  )
})

Template.displayName = 'Template'

export default Template
