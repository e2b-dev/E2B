import Image from 'next/image'

function Replicate() {
  return (
    <Image
      className="
        w-[30px]
        h-[30px]
        rounded
      "
      width={30}
      height={30}
      alt="Replicate logo"
      src="/replicate.png"
    />
  )
}

export default Replicate