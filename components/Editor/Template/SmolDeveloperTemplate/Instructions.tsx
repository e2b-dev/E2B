import useReferences from 'hooks/useReferences'

import InstructionsEditor from './InstructionsEditor'

export interface Props {
  description: string
  setDescription: (description: string) => void
}

function Instructions({ description, setDescription }: Props) {
  const [referenceSearch] = useReferences()

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
        referenceSearch={referenceSearch}
        title="Specify what should the Stripe dev do:"
        placeholder=""
        content={description}
        onChange={setDescription}
      />
    </div>
  )
}

export default Instructions
