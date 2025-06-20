/**
 * Get the URL signature for the specified path, operation and user.
 *
 * @param path Path to the file in the sandbox.
 *
 * @param operation File system operation. Can be either `read` or `write`.
 *
 * @param user Sandbox user.
 *
 * @param expirationInSeconds Optional signature expiration time in seconds.
 */

interface SignatureOpts {
  path: string
  operation: 'read' | 'write'
  user: string
  expirationInSeconds?: number
  envdAccessToken?: string
}

// Cross-platform crypto implementation
async function sha256(data: string): Promise<string> {
  // Use Node.js crypto if WebCrypto is not available
  if (!crypto) {
    const { createHash } = require('node:crypto')
    const hash = createHash('sha256').update(data, 'utf8').digest()
    return hash.toString('base64')
  }

  // Use WebCrypto API if available
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = new Uint8Array(hashBuffer)
  return btoa(String.fromCharCode(...hashArray))
}

export async function getSignature({
  path,
  operation,
  user,
  expirationInSeconds,
  envdAccessToken,
}: SignatureOpts): Promise<{ signature: string; expiration: number | null }> {
  if (!envdAccessToken) {
    throw new Error(
      'Access token is not set and signature cannot be generated!'
    )
  }

  // expiration is unix timestamp
  const signatureExpiration = expirationInSeconds
    ? Math.floor(Date.now() / 1000) + expirationInSeconds
    : null
  let signatureRaw: string

  if (signatureExpiration === null) {
    signatureRaw = `${path}:${operation}:${user}:${envdAccessToken}`
  } else {
    signatureRaw = `${path}:${operation}:${user}:${envdAccessToken}:${signatureExpiration.toString()}`
  }

  const hashBase64 = await sha256(signatureRaw)
  const signature = 'v1_' + hashBase64.replace(/=+$/, '')

  return {
    signature: signature,
    expiration: signatureExpiration,
  }
}
