export interface Props {
  code: string
}

function Code({ code }: Props) {
  return (
    <div className="
      flex
      flex-col
      bg-white
      overflow-y-auto
      text-xs
      leading-4
      break-words
      w-[250px]
      whitespace-normal
      space-y-2
      p-4
    ">
      {code}
    </div>
  )
}

export default Code