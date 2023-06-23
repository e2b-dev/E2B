import {
  useState,
} from 'react'
import {
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import {
  useMetadata,
} from 'hooks/filesystem'

import { AgentChallengeTag as AgentChallengeTagType } from 'utils/agentLogs'
import AgentChallengeTagButton from 'components/AgentChallengeTagButton'
import { Severity } from 'components/AgentChallengeTagModal'
import AgentChallengeTag from 'components/AgentChallengeTag'
import {
  DirProps,
  NodeType,
} from 'filesystem'




// export interface CustomProps {
//   tags: [{
//     type: string
//     challenge: string
//   }]
// }
// export type Props = DirProps & CustomProps

function Dir({
  name,
  path,
  onSelect,
  metadata,
  children,
  fs,
  isExpanded,
  isSelected,
}: DirProps) {
  const [node] = useState(fs.find(path))
  const [newTagName, setNewTagName] = useState('')
  const [, setMetadata] = useMetadata<AgentChallengeTagType[]>(fs, path, 'tags', true)
  const tags = metadata?.tags || [] as AgentChallengeTagType[]
  // console.log('metadata', metadata)

  // useEffect(() => {
  //   if (path === '/20230616_054339_memory_challenge_a_level_3') {
  //     setMetadata([{ challengeDir: '20230616_054339_memory_challenge_a_level_3', text: 'challenge', color: 'red' }])
  //   }
  // }, [path])


  function handleOnClick(e: any) {
    fs.setIsDirExpanded(path, !isExpanded)

    // This conditions prevents deselecting when user clicks on a dir that's already selected.
    if (path !== fs.selectedPath) {
      fs.setIsNodeSelected(path, !isSelected)
    }

    onSelect?.(e,
      {
        type: NodeType.Dir,
        path,
        name,
        metadata,
        isSelected,
        isExpanded,
      })
  }

  function addNewTag(s: Severity) {
    if (!newTagName) return
    // TODO: Add tag in DB to all files that has this challenge dir as an ancestor
    const newTag: AgentChallengeTagType = {
      path,
      text: newTagName,
      severity: s,
    }
    console.log('New tag', newTag)
    setNewTagName('')
    setMetadata([newTag])
  }

  function removeTag() {
    setMetadata([])
  }

  const icon = isExpanded ? (
    <ChevronDown
      className="text-white/60 shrink-0"
      size={16}
    />
  ) : (
    <ChevronRight
      className="text-white/60 shrink-0"
      size={16}
    />
  )

  return (
    <div className="flex flex-col rounded w-full">
      <div className="flex items-center justify-start w-full space-x-1">
        {tags.map((tag: AgentChallengeTagType, i: number) => (
          <div className="flex items-center space-x-1" key={i}>
            <AgentChallengeTag
              tag={tag}
            />
            <button
              className="text-gray-400 hover:text-gray-400"
              onClick={removeTag}
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* AutoGPT wants to add tags only for challenges - challenges are the first "dirs" -> very heuristic and works only for AutoGPT */}
        {tags.length === 0 && node?.level === 0 && (
          <AgentChallengeTagButton
            newTagName={newTagName}
            onNewTagNameChange={e => setNewTagName(e.target.value)}
            onSeveritySelect={addNewTag}
          />
        )}
        <div
          className={clsx(
            'px-1',
            'py-2',
            'flex',
            'items-center',
            'w-full',
            'rounded-md',
            'space-x-1',
            'cursor-pointer',
            'border-gray-800',
            'hover:bg-[#1F2437]',
            { 'bg-transparent': !isSelected },
          )}
          onClick={handleOnClick}
        >
          {icon}
          <span
            className="
              text-sm
              text-gray-200
              whitespace-nowrap
              ">
            {name}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div
          className="
            flex
            flex-col
            space-y-2
            lg:space-y-1
            mt-1
            ml-[11px]
            pl-3
            border-l
            border-white/5
          "
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default Dir
