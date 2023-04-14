import Image from 'next/image'

function OpenAI() {
  return (
    <Image
      className="
        w-[30px]
        h-[30px]
        rounded
      "
      width={30}
      height={30}
      alt="OpenAI logo"
      src="/open-ai.png"
    />
  )
}

export default OpenAI