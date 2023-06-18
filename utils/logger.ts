export function logger(namespace: string, color: string = 'orange') {
  return function (...args: any[]) {
    console.groupCollapsed(`%c[${namespace}]`, `color:${color};`, ...args)
    console.trace()
    console.groupEnd()
  }
}
