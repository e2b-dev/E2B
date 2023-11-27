export interface Props {
  templateName: string
}

export function TemplateName({
  templateName,
}: Props) {
  return (
    <div className="pr-1 w-[320px] flex items-center justify-start space-x-2 border border-gray-600 rounded">
      <span className="font-mono text-sm px-2 h-8 flex items-center justify-center border-r border-gray-600">template name</span>
      <span className="font-mono text-sm text-gray-200">{templateName}</span>
    </div>
  )
}