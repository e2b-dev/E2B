import { forwardRef } from 'react'
import { useStateStore } from 'state/StoreProvider'
import { templates } from 'state/template'


export interface Props { }

const Template = forwardRef<HTMLDivElement, Props>(({ }, ref) => {
  const [selectors] = useStateStore()
  const templateID = selectors.use.templateID()

  return (
    <div
      ref={ref}
      className="
      flex
      flex-col
      flex-1
  ">
      {templates[templateID].component}
    </div>
  )
})

Template.displayName = 'Template'

export default Template
