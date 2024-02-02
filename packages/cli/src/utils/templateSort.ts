import * as sdk from 'e2b'

export function sortEnvsAliases<E extends sdk.components['schemas']['Environment']['aliases']>(aliases: E) {
  aliases?.sort()
}
