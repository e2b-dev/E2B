import ReactMarkdown from 'react-markdown'

export interface Props {
  rawOutput?: string | null
}

function RawStepsStream({
  rawOutput,
}: Props) {
  return (
    <div
      className="
        flex-1
        overflow-auto
        text-xs
        tracking-wide
        font-sans
        scroller
        whitespace-pre-wrap
        py-4
        flex
        flex-col
        bg-slate-50
        space-y-4
        px-2
    ">
      {rawOutput &&
        <ReactMarkdown>
          {rawOutput}
        </ReactMarkdown>
      }
    </div>
  )
}

export default RawStepsStream
