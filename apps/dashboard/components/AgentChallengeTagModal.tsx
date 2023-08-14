import {
  useRef,
} from 'react'
import useOnClickOutside from 'hooks/useOnClickOutside'

export type Severity = 'Success' | 'Warning' | 'Error'

export interface Props {
  value: string
  onChange: (e: any) => void
  onClickOutside: (e: any) => void
  onSeveritySelect: (s: Severity) => void
}

function AgentChallengeTagModal({
  value,
  onChange,
  onClickOutside,
  onSeveritySelect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  function handleClickOutside(e: any) {
    onClickOutside(e)
  }

  useOnClickOutside(ref, handleClickOutside)

  return (
    <div
      ref={ref}
      className="
      absolute
      mt-1
      w-[200px]
      border
      border-[#6366F1]/50
      shadow-lg
      bg-[#1F2437]
      z-50
      rounded-lg
    ">
      <input
        className="
          w-full
          bg-transparent
          p-4
          text-sm
          outline-none
          border-b
          border-b-white/5
          placeholder:text-gray-600
        "
        value={value}
        onChange={onChange}
        placeholder="Tag name"
        autoFocus
      />
      <span className="p-2 text-xs text-gray-500">Select Severity</span>
      <div className="
        p-2
        flex
        flex-col
        space-y-2
        items-start
        justify-start
      ">
        <button
          className="w-full rounded p-2 flex items-center justify-start space-x-2 hover:bg-[#31374F]"
          onClick={() => onSeveritySelect('Success')}
        >
          <div className="w-4 h-4 flex items-center justify-center bg-green-500/10 border border-green-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-gray-300">Success</span>
        </button>

        <button
          className="w-full rounded p-2 flex items-center justify-start space-x-2 hover:bg-[#31374F]"
          onClick={() => onSeveritySelect('Warning')}
        >
          <div className="w-4 h-4 flex items-center justify-center bg-orange-500/10 border border-orange-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
          </div>
          <span className="text-sm text-gray-300">Warning</span>
        </button>

        <button
          className="w-full rounded p-2 flex items-center justify-start space-x-2 hover:bg-[#31374F]"
          onClick={() => onSeveritySelect('Error')}
        >
          <div className="w-4 h-4 flex items-center justify-center bg-red-500/10 border border-red-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-red-500" />
          </div>
          <span className="text-sm text-gray-300">Error</span>
        </button>
      </div>
    </div>
  )
}

export default AgentChallengeTagModal