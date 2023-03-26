import {
  useState,
  useCallback,
  RefCallback,
} from 'react'

function useElement<T>(cb?: (element: T) => any): [T | undefined, (instance: T | null) => void] {
  const [element, setElement] = useState<T>()

  const initElementRef = useCallback<RefCallback<T>>((element) => {
    if (element !== null) {
      cb?.(element)
      setElement(element)
    }
  }, [])

  return [element, initElementRef]
}

export default useElement
