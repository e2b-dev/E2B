import type { Interceptor } from '@connectrpc/connect'
import type { Middleware } from 'openapi-fetch'

/**
 * Logger interface compatible with `console` that can be used in places that accept `Logger`
 * to log messages into the console.
 */
export interface Logger {
  debug?: (...args: any[]) => void
  info?: (...args: any[]) => void
  error?: (...args: any[]) => void
}

function formatLog(log: any) {
  return JSON.parse(JSON.stringify(log))
}

export function createRpcLogger(logger: Logger): Interceptor {
  async function* logEach(stream: AsyncIterable<any>) {
    for await (const m of stream) {
      logger.debug?.('Response stream:', formatLog(m))
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
      logger.info?.('Response:', formatLog(res.message))
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
