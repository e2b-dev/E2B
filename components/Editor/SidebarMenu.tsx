import clsx from 'clsx'
import { Code, Lock, Cpu, WholeWord, Server, Brain } from 'lucide-react'

export enum MenuSection {
  Run = 'Run',
  Model = 'Model',
  Prompt = 'Prompt',
  Memory = 'Memory',
  Envs = 'Envs',
  Deploy = 'Deploy',
}

const menuIconSize = '18px'

function getMenuSelectionIcon(selection: MenuSection) {
  switch (selection) {
    case MenuSection.Run:
      return <Code size={menuIconSize} />
    case MenuSection.Prompt:
      return <WholeWord size={menuIconSize} />
    case MenuSection.Memory:
      return <Brain size={menuIconSize} />
    case MenuSection.Model:
      return <Cpu size={menuIconSize} />
    case MenuSection.Envs:
      return <Lock size={menuIconSize} />
    case MenuSection.Deploy:
      return <Server size={menuIconSize} />
  }
}

export interface Props {
  selected: MenuSection
  setSelected: (section: MenuSection) => void
}

function SidebarMenu({ selected, setSelected }: Props) {
  return (
    <div className="
    w-14
    flex
    py-2
    text-sm
    border-l
    bg-white
    flex-col
    space-y-4
    items-center
  "
    >
      {Object.values(MenuSection).map(m =>
        <button
          key={m}
          className={clsx(`
        hover:text-green-800
        transition-all
        text-xs
        items-center
        justify-center
        flex
        flex-col
        space-y-1
        `,
            {
              'text-slate-400': selected !== m,
              'text-slate-600': selected === m,
            }
          )}
          onClick={() => setSelected(m)}
        >
          {getMenuSelectionIcon(m)}
          <span>
            {m.toString()}
          </span>
        </button>
      )}
    </div>
  )
}

export default SidebarMenu
