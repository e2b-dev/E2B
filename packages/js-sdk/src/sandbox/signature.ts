import crypto from 'node:crypto'

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

export function getSignature({ path, operation, user, expirationInSeconds, envdAccessToken }: SignatureOpts): { signature: string; expiration: number | null } {
    if (!envdAccessToken) {
        throw new Error('Access token is not set and signature cannot be generated!')
    }

    // expiration is unix timestamp
    const signatureExpiration = expirationInSeconds ? Math.floor(Date.now() / 1000) + expirationInSeconds : null
    let signatureRaw: string

    if (signatureExpiration === null) {
        signatureRaw = `${path}:${operation}:${user}:${envdAccessToken}`
    } else {
        signatureRaw = `${path}:${operation}:${user}:${envdAccessToken}:${signatureExpiration.toString()}`
    }

    const buff = Buffer.from(signatureRaw, 'utf8')
    const hash = crypto.createHash('sha256').update(buff).digest()
    const signature =  'v1_' + hash.toString('base64').replace(/=+$/, '')

    return {
        signature: signature,
        expiration: signatureExpiration
    }
}