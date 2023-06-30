import {
  Github,
} from 'lucide-react'

export interface Props {
  onClick: (e: any) => void
}

function ConfigureGitHubButton({
  onClick,
}: Props) {
  return (
    <button
      type="button"
      className="flex items-center space-x-2 rounded-md bg-white/10 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/20 transition-all"
      onClick={onClick}
    >
      <Github size={16} />
      <span>Configure GitHub Permissions</span>
    </button>
  )
}

export default ConfigureGitHubButton