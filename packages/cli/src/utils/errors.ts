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

type E2BResponseError = { code?: number; message?: string }

type E2BResponse<TData> =
  | {
      data: TData
      error?: undefined
    }
  | {
      data?: undefined
      error: E2BResponseError
    }

export function throwE2BRequestError(
  error: E2BResponseError,
  errMsg?: string
): never {
  let message: string
  const code = error.code ?? 0
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
      message = status.message[code] || 'unknown error'
      break
  }

  throw new E2BRequestError(
    `${errMsg && `${errMsg}: `}[${code}] ${message && `${message}: `}${
      error.message ?? 'no message'
    }`
  )
}

export function handleE2BRequestError(
  res: { error: E2BResponseError },
  errMsg?: string
): never
export function handleE2BRequestError<TData>(
  res: E2BResponse<TData>,
  errMsg?: string
): asserts res is { data: TData; error?: undefined }
export function handleE2BRequestError(
  res: E2BResponse<unknown>,
  errMsg?: string
) {
  if (!res.error) {
    return
  }
  throwE2BRequestError(res.error, errMsg)
}
