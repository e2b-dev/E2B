import { useCallback } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import produce from 'immer'

import { ArgValue, ModelArgs, ModelProvider } from 'state/model'

export type Creds = {
  [model in keyof typeof ModelProvider]?: {
    creds?: ModelArgs
  }
}

export interface MergeCreds {
  (provider: ModelProvider, key: string, value?: ArgValue): void
}

function useModelProviderArgs(): [Creds, MergeCreds] {
  const [creds, setCreds] = useLocalStorage<Creds>('e2b-model-creds', {})

  const mergeCreds = useCallback<MergeCreds>((provider, key, value) => {
    setCreds(produce(creds, d => {
      if (!d[provider]?.creds) {
        d[provider] = { creds: { [key]: value } }
        return
      }

      d[provider]!.creds![key] = value
    }))
  }, [creds, setCreds])

  return [creds, mergeCreds]
}

export default useModelProviderArgs
