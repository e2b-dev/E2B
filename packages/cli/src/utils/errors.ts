import status from 'statuses'

/**
 * Thrown when a request to E2B API occurs.
 */
export class E2BRequestError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'E2BRequestError'
  }
}

export function handleE2BRequestError<T>(
  res: {
    data?: T | null | undefined
    error?: { code: number; message: string }
  },
  errMsg?: string
): asserts res is { data: T; error?: undefined } {
  if (!res.error) {
    return
  }

  let message: string
  const code = res.error?.code ?? 0
  switch (code) {
    case 400:
      message = 'bad request'
      break
    case 401:
      message = 'unauthorized'
      break
    case 403:
      message = 'forbidden'
      break
    case 404:
      message = 'not found'
      break
    case 500:
      message = 'internal server error'
      break
    default:
      message = status(code) || 'unknown error'
      break
  }

  throw new E2BRequestError(
    `${errMsg && `${errMsg}: `}[${code}] ${message && `${message}: `}${
      res.error?.message ?? 'no message'
    }`
  )
}
