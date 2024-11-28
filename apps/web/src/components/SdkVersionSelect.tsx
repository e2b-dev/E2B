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
      className="text-xs text-brand-400"
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
