import type { Interceptor } from '@connectrpc/connect'
import type { Middleware } from 'openapi-fetch'

export interface Logger {
  debug?: (...args: any[]) => void
  info?: (...args: any[]) => void
  error?: (...args: any[]) => void
}

export function createRpcLogger(logger: Logger): Interceptor {
  async function* logEach(stream: AsyncIterable<any>) {
    for await (const m of stream) {
      logger.debug?.('Response stream:', m)
      yield m
    }
  }

  return (next) => async (req) => {
    logger.info?.(`Request: POST ${req.url}`)

    const res = await next(req)
    if (res.stream) {
      return {
        ...res,
        message: logEach(res.message),
      }
    } else {
      logger.info?.('Response:', res.message)
    }

    return res
  }
}

export function createApiLogger(logger: Logger): Middleware {
  return {
    async onRequest(req) {
      logger.info?.(`Request ${req.method} ${req.url}`)

      return req
    },
    async onResponse(res) {
      if (res.status >= 400) {
        logger.error?.('Response:', res.status, res.statusText)
      } else {
        logger.info?.('Response:', res.status, res.statusText)
      }

      return res
    },
  }
}
