import { useCallback } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import produce from 'immer'

import { ArgValue, EvaluatedArgs, ModelProvider } from 'state/model'

export type Creds = {
  [model in keyof typeof ModelProvider]?: {
    creds?: EvaluatedArgs
  }
}

function useModelProviderCreds() {
  const [creds, setCreds] = useLocalStorage<Creds>('e2b-model-creds', {})

  const mergeCreds = useCallback((provider: ModelProvider, key: string, value?: ArgValue) => {
    setCreds(produce(creds, d => {
      if (!value) {
        delete d[provider]?.creds?.[key]
        return
      }

      if (!d[provider]?.creds) {
        d[provider] = { creds: { [key]: value } }
        return
      }

      d[provider]!.creds![key] = value
    }))
  }, [creds, setCreds])

  return [creds, mergeCreds]
}

export default useModelProviderCreds
