function stringify(obj: any) {
  const getCircularReplacer = () => {
    const seen = new WeakSet()
    return (_: any, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return
        }
        seen.add(value)
      }
      return value
    }
  }
  return JSON.stringify(obj, getCircularReplacer(), 2)
}

export default stringify
