
/**
 * Obfuscate the API key by replacing the middle part with asterisks
 */
export function obfuscateKey(apiKey: string) {
  return (
    apiKey.substring(0, 7) + '*'.repeat(4) + apiKey.substring(apiKey.length - 3)
  )
}