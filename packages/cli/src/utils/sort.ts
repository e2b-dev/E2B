import * as sdk from '@devbookhq/sdk'

export function sortEnvs<E extends sdk.components['schemas']['Environment']>(a: E, b: E) {
  if (!a.title || !b.title) return 0
  if (!a.title) return 1
  if (!b.title) return -1

  return a.title.localeCompare(b.title)
}
