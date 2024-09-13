import * as sdk from 'e2b'

export function sortTemplatesAliases<
  E extends sdk.components['schemas']['Template']['aliases'],
>(aliases: E) {
  aliases?.sort()
}
