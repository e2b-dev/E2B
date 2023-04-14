import Text from 'components/Text'
import { providerIcons } from 'components/icons/ProviderIcon'
import { ModelProvider } from 'state/model'

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
        {providerIcons[provider]}
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