import {
  useEffect,
  RefObject,
  DependencyList,
} from 'react'

function useOnClickOutside(ref: RefObject<HTMLElement>, cb: (e: MouseEvent) => any, deps: DependencyList = []) {
  useEffect(function listenToMouseDownEvent() {
    function handleMouseDown(e: MouseEvent) {
      if (e.target && !ref.current?.contains(e.target as Node)) {
        cb(e)
      }
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    return () => document.removeEventListener('mousedown', handleMouseDown, true)
  }, [ref, cb, ...deps])
}

export default useOnClickOutside