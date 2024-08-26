
/**
 * Thrown when a request to E2B API occurs.
 */
export class E2BRequestError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'E2BRequestError'
  }
}


export function handleE2BRequestError(err?: { code: number; message: string; }, errMsg?: string) {
  if (!err) {
    return
  }

  let message = ''
  switch (err.code) {
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
  }

  throw new E2BRequestError(`${errMsg && `${errMsg}: `}[${err.code}] ${message && `${message}: `}${err.message ?? 'no message'}`)
}
