export function logger(namespace: string, color: string = 'orange', enabled: boolean = true) {
  return function (...args: any[]) {
    if (!enabled) return
    console.groupCollapsed(`%c[${namespace}]`, `color:${color};`, ...args)
    console.trace()
    console.groupEnd()
  }
}
