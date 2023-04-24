import clsx from 'clsx'
import { Template } from 'state/template'
import Text from './Text'

export interface Props {
  onClick: () => void
  template: Template
  isSelected?: boolean
}

function TemplateButton({
  onClick,
  template,
  isSelected,
}: Props) {
  return (
    <div
      onClick={onClick}
      className={clsx(`
        py-2
        px-4
        cursor-pointer
        border
        border-green-800
        rounded`,
        {
          'border-green-800': isSelected,
          'border-transparent': !isSelected,
        },
      )}>
      <div className="
          flex
          space-x-6
          items-center
        ">
        <div className="h-8 w-8">
          {template.icon}
        </div>
        <div className="
            flex
            flex-col
            items-start
            space-y-0.5
          ">
          <Text
            className="
                font-semibold
                text-slate-700
              "
            text={template.description}
          />
          <Text
            size={Text.size.S3}
            className="
                text-slate-500
              "
            text={template.stackDescription}
          />
        </div>
      </div>
    </div>
  )
}

export default TemplateButton
