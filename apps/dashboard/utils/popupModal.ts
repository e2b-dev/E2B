export function openPopupModal(url: URL) {
  const features = {
    popup: 'yes',
    width: 820,
    height: 700,
    top: 'auto',
    left: 'auto',
    toolbar: 'no',
    menubar: 'no',
  }
  const strWindowsFeatures = Object.entries(features)
    .reduce((str, [key, value]) => {
      if (value == 'auto') {
        if (key === 'top') {
          const v = Math.round(
            window.innerHeight / 2 - features.height / 2
          )
          str += `top=${v},`
        } else if (key === 'left') {
          const v = Math.round(
            window.innerWidth / 2 - features.width / 2
          )
          str += `left=${v},`
        }
        return str
      }

      str += `${key}=${value},`
      return str
    }, '')
    .slice(0, -1) // remove last ',' (comma)
  return window.open(url, '_blank', strWindowsFeatures)
}
