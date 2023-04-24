import { ReactNode } from 'react'
import Image from 'next/image'

import { ModelProvider } from 'state/model'

const iconPaths: {
  [provider in keyof typeof ModelProvider]: string
} = {
  [ModelProvider.OpenAI]: '/open-ai.png',
  [ModelProvider.Replicate]: '/replicate.png',
  [ModelProvider.Anthropic]: '/anthropic.png',
  [ModelProvider.HuggingFace]: '/hugging-face.png',
  [ModelProvider.Banana]: '/banana.jpg',
}

export const providerIcons = Object
  .values(ModelProvider)
  .reduce<{ [provider in keyof typeof ModelProvider]?: ReactNode }>((prev, curr) => ({
    ...prev,
    [curr]: <ProviderIcon provider={curr} />,
  }), {})

export interface Props {
  provider: ModelProvider
}

function ProviderIcon({ provider }: Props) {
  return (
    <div className="
      w-[30px]
      h-[30px]
      relative
    ">
      <Image
        className="
          rounded
        "
        width={90}
        height={90}
        alt={`${provider} logo`}
        src={iconPaths[provider]}
        priority
      />
    </div>
  )
}

export default ProviderIcon
