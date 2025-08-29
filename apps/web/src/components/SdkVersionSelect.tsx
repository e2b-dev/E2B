export interface Props {
  selectedVersion: string
  versions: string[]
  onVersionChange: (version: string) => void
}

export function SdkVersionSelect({
  selectedVersion,
  versions,
  onVersionChange,
}: Props) {
  return (
    <select
      className="
        appearance-none
        text-xs
        text-brand-400
        bg-transparent
        cursor-pointer
        border
        border-[#ff880040]
        hover:border-brand-400
        transition-colors
        rounded-md
        pr-[10px]
        pl-1
        py-1
      "
      value={selectedVersion}
      onChange={(e) => {
        onVersionChange(e.target.value)
      }}
    >
      {versions.map((version, i) => (
        <option key={version} value={version}>
          {i === 0 ? `${version}@latest` : version}
        </option>
      ))}
    </select>
  )
}
