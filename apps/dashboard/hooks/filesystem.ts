import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import Filesystem from '../filesystem/filesystem'
import Node from '../filesystem/node'

export function useFilesystem({
  rootPath = '/',
  initial = [],
}: { rootPath?: string, initial?: Node[] } = {
    rootPath: '/',
    initial: [],
  }) {
  const [fs] = useState(() => new Filesystem(rootPath, initial))
  return fs
}

export function useChildren(fs: Filesystem, path: string, shouldRegisterListener: boolean) {
  const [children, setChildren] = useState<Node[]>([])

  useEffect(function getChildren() {
    if (!shouldRegisterListener) return

    const remove = fs.addDirListener(path, (_, children) => {
      setChildren([...children])
    })
    setChildren([...fs.getChildren(path)])
    return () => { remove() }
  }, [
    fs,
    path,
    shouldRegisterListener,
  ])

  return children
}

type MetadataValue<T> = T | undefined
type MetadataFuncValue<T> = (currentVal: T | undefined) => T | undefined
export function useMetadata<T>(fs: Filesystem, path: string, key: string, shouldRegisterListener: boolean): [MetadataValue<T>, (newValue: MetadataValue<T> | MetadataFuncValue<T>) => void] {
  // TODO: We can't detect if user didn't pass `initialValue` because that's the same as passing undefined
  // as the initial value.
  // So if a node already has some value for the key and user didn't pass any initialValue, we overwrite it
  // which we shouldn't do.

  const [val, setVal] = useState<T>()

  const setMetadata = useCallback<(value: MetadataValue<T> | ((currentVal: MetadataValue<T>) => MetadataValue<T>)) => void>(value => {
    let v: T | undefined
    if (value instanceof Function) {
      v = value(val)
    } else {
      v = value
    }

    fs.setMetadata<T>(path, {
      key,
      value: v,
    })
    // No need to call `setVal` because `setVal` will get called thanks
    // to the registered metadata listener below.
  }, [
    fs,
    path,
    key,
    val,
  ])

  useEffect(function registerMetadataListener() {
    if (!shouldRegisterListener) return

    const remove = fs.addMetadataListener<T>(path, key, (_, { newVal }) => {
      setVal(newVal)
    })
    setVal(fs.getMetadata<T>(path, key))
    return () => { remove() }
  }, [
    fs,
    path,
    key,
    setVal,
    shouldRegisterListener,
  ])

  return [val, setMetadata]
}
