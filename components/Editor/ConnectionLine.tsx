export interface Props {
  className: string
}

export default function ConnectionLine({ className }: Props) {
  return (
    <div className={`${className} border-l my-2 rounded border-slate-200`} />
  )
}
