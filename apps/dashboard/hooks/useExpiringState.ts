import debounce from 'lodash.debounce'
import { useCallback, useMemo, useState } from 'react'

export interface Props<T> {
  defaultValue: T
  timeout: number // in ms
}

function useExpiringState<T>({
  defaultValue,
  timeout,
}: Props<T>): [T, (value: T) => void] {
  const [value, setValue] = useState(defaultValue)

  const enqueExpiration = useMemo(() => debounce(() => {
    setValue(defaultValue)
  }, timeout, {
    leading: false,
    trailing: true,
  }), [timeout, defaultValue])

  const set = useCallback((newValue: T) => {
    setValue(newValue)
    enqueExpiration()
  }, [enqueExpiration])

  return [value, set]
}

export default useExpiringState
