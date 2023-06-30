import Text from 'components/Text'
import Input from 'components/Input'

export interface Props {
  repoUrl: string
  setRepoUrl: (url: string) => void
}

function Repo({
  repoUrl,
  setRepoUrl,
}: Props) {
  return (
    <div>
      <div
        className="
        flex
        border-b
        space-x-4
        items-center
        px-4
        "
      >
        <Text
          text="Repository URL"
          className="
          font-semibold
          py-3.5
          uppercase
          text-slate-400
        "
          size={Text.size.S2}
        />
        <Input
          onChange={setRepoUrl}
          value={repoUrl}
        />
      </div>
    </div>
  )
}

export default Repo
