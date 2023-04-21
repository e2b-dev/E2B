import { useRouter } from 'next/router'
import Link from 'next/link'

import Text from 'components/Text'
import { providerIcons } from 'components/icons/ProviderIcon'
import { ModelProvider, getMissingCreds, ProviderTemplate, Model } from 'state/model'
import { Creds } from 'hooks/useModelProviderArgs'
import Button from 'components/Button'
import { useStateStore } from 'state/StoreProvider'

import ModelSection from './ModelSection'

export interface Props {
  provider: ModelProvider
  selectedModel: Model
  creds: Creds
  template: ProviderTemplate
}

function ProviderCard({
  provider,
  template,
  creds,
  selectedModel,
}: Props) {
  const router = useRouter()
  const [selectors] = useStateStore()

  const selectModel = selectors.use.selectModel()
  const setModelConfig = selectors.use.setModelConfig()

  return (
    <div className="
      flex
      justify-between
      flex-1
      flex-col
      space-y-2
      py-2
      items-stretch
    ">
      <div className="
        flex
        justify-between
        flex-1
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
        <div className="
              flex
              space-y-1
            "
        >
          {template.creds &&
            <div
              className="
                  space-x-2
                  flex
                "
            >
              <Text
                text={getMissingCreds(provider as ModelProvider, creds).length === 0 ? '' : 'Missing keys'}
                className="
                      text-slate-400
                    "
                size={Text.size.S3}
              />
              <Button
                text="Set keys"
                className="whitespace-pre-wrap"
                onClick={() => router.push('/settings')}
              />
            </div>
          }
        </div>
      </div>
      {template.link &&
        <div className="flex">
          <Link
            href={template.link}
            target="_blank"
            rel="noreferrer"
          >
            <Text
              className="
              font-medium
              text-[#527CE7]
              "
              text={template.link.replace('https://', '')}
            />
          </Link>
        </div>
      }
      <div className="
              flex
              items-stretch
              flex-col
              flex-1
              pt-2
            "
      >
        {template.models.map(m =>
          <ModelSection
            key={m.name}
            provider={provider}
            modelTemplate={m}
            selectModel={() => selectModel({ provider, name: m.name })}
            isSelected={m.name === selectedModel?.name && provider === selectedModel.provider}
            updateModelConfig={c => setModelConfig({
              name: m.name,
              provider: provider as ModelProvider,
              ...c,
            })}
          />
        )}
      </div>

    </div>
  )
}

export default ProviderCard
