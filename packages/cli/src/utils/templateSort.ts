import * as sdk from '@e2b/sdk'

export function sortEnvsAliases<E extends sdk.components['schemas']['Environment']['aliases']>(aliases: E) {
  aliases?.sort()
}
