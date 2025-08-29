import debounce from 'lodash.debounce'
import { useCallback, useMemo, useState } from 'react'

function useExpiringState({ defaultValue, timeout }) {
  const [value, setValue] = useState(defaultValue)

  const enqueExpiration = useMemo(
    () =>
      debounce(
        () => {
          setValue(defaultValue)
        },
        timeout,
        {
          leading: false,
          trailing: true,
        }
      ),
    [timeout, defaultValue]
  )

  const set = useCallback(
    (newValue) => {
      setValue(newValue)
      enqueExpiration()
    },
    [enqueExpiration]
  )

  return [value, set]
}

export default useExpiringState
