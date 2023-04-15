import { ReactNode } from 'react'
import Image from 'next/image'

import { ModelProvider } from 'state/model'

const iconPaths: {
  [provider in keyof typeof ModelProvider]: string
} = {
  [ModelProvider.HuggingFace]: '/huggingface.png',
  [ModelProvider.OpenAI]: '/open-ai.png',
  [ModelProvider.Replicate]: '/replicate.png',
  [ModelProvider.Anthropic]: '/anthropic.png',
}

export const providerIcons: {
  [provider in keyof typeof ModelProvider]: ReactNode
} = {
  [ModelProvider.HuggingFace]: <ProviderIcon provider={ModelProvider.HuggingFace} />,
  [ModelProvider.OpenAI]: <ProviderIcon provider={ModelProvider.OpenAI} />,
  [ModelProvider.Replicate]: <ProviderIcon provider={ModelProvider.Replicate} />,
  [ModelProvider.Anthropic]: <ProviderIcon provider={ModelProvider.Anthropic} />,
}

export interface Props {
  provider: ModelProvider
}

function ProviderIcon({ provider }: Props) {
  return (
    <div className="
      w-[30px]
      h-[30px]
      rounded
      relative
    ">
      <Image
        className="
        rounded
      "
        alt={`${provider} logo`}
        src={iconPaths[provider]}
        fill
        priority
      />
    </div>
  )
}

export default ProviderIcon
