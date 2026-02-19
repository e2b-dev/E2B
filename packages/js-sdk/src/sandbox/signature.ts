import { sha256 } from '../utils'

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
  user: string | undefined
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

  // if user is undefined, set it to empty string to handle default user
  if (user == undefined) {
    user = ''
  }

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
