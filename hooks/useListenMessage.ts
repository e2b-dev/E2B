import {
  useEffect,
} from 'react'

function useListenMessage(callback: (event: MessageEvent<any>) => void) {
  useEffect(function register() {
    window.addEventListener('message', callback)
    return () => {
      window.removeEventListener('message', callback)
    }
  }, [callback])
}

export default useListenMessage
