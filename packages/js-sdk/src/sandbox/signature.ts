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

  // Use TextEncoder to convert string to Uint8Array
  const encoder = new TextEncoder()
  const data = encoder.encode(signatureRaw)

  // Use WebCrypto to create SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // Convert ArrayBuffer to base64 string
  const hashArray = new Uint8Array(hashBuffer)
  const hashBase64 = btoa(String.fromCharCode(...hashArray))
  const signature = 'v1_' + hashBase64.replace(/=+$/, '')

  return {
    signature: signature,
    expiration: signatureExpiration,
  }
}
