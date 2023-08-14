export interface Props {
  text: string
  onClick: () => void
}

function InstructionsTemplateButton({
  text,
  onClick,
}: Props) {
  return (
    <button
      className="flex items-center rounded-md bg-indigo-400/10 active:bg-indigo-400/20 px-2 py-1 text-xs font-medium text-indigo-400 border border-indigo-400/30 hover:border-indigo-400 cursor-pointer transition-all whitespace-nowrap"
      onClick={onClick}
    >
      {text}
    </button>
  )
}

export default InstructionsTemplateButton
