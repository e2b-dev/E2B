import Text from 'components/Text'
import { ModelProvider } from 'state/model'
import OpenAIIcon from 'components/icons/OpenAI'
import ReplicateIcon from 'components/icons/Replicate'


const providerIcons = {
  [ModelProvider.OpenAI]: <OpenAIIcon />,
  [ModelProvider.Replicate]: <ReplicateIcon />,
}

export interface Props {
  provider: ModelProvider
}

function ProviderHeader({
  provider,
}: Props) {
  return (
    <div className="
      flex
      justify-between
    ">
      <div className="
        flex
        items-center
        space-x-2
      ">
        {providerIcons[provider as ModelProvider]}
        <Text
          text={provider}
          className="
            font-medium
            text-slate-400
          "
          size={Text.size.S2}
        />
      </div>
    </div>
  )
}

export default ProviderHeader