import { runtime } from './api/metadata'

export async function sha256(data: string): Promise<string> {
  // Use WebCrypto API if available
  if (typeof crypto !== 'undefined') {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = new Uint8Array(hashBuffer)
    return btoa(String.fromCharCode(...hashArray))
  }

  // Use Node.js crypto if WebCrypto is not available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require('node:crypto')
  const hash = createHash('sha256').update(data, 'utf8').digest()
  return hash.toString('base64')
}

export function timeoutToSeconds(timeout: number): number {
  return Math.ceil(timeout / 1000)
}

export function dynamicGlob(): typeof import('glob') {
  if (runtime === 'browser') {
    throw new Error('Browser runtime is not supported for glob')
  }

  return require('glob')
}

export function dynamicTar(): typeof import('tar') {
  if (runtime === 'browser') {
    throw new Error('Browser runtime is not supported for tar')
  }

  return require('tar')
}
