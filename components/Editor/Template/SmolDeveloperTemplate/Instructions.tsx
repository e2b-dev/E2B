import InstructionsEditor from './InstructionsEditor'

export interface Props {
  description: string
  setDescription: (description: string) => void
}

function Instructions({ description, setDescription }: Props) {
  return (
    <div className="
      py-8
      px-4
      flex
      flex-1
      bg-white
      justify-center
      overflow-auto
      scroller
      w-full
      h-full
    ">
      <InstructionsEditor
        title="Specify Smol developer prompt:"
        placeholder=""
        content={description}
        onChange={setDescription}
      />
    </div>
  )
}

export default Instructions
