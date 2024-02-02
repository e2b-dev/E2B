import * as sdk from '@e2b/sdk'

export function sortTemplatesAliases<E extends sdk.components['schemas']['Template']['aliases']>(aliases: E) {
  aliases?.sort()
}
