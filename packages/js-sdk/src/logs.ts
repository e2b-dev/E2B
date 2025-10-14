import type { Interceptor } from '@connectrpc/connect'
import type { Middleware } from 'openapi-fetch'

/**
 * Logger interface compatible with {@link console} used for logging Sandbox messages.
 */
export interface Logger {
  /**
   * Debug level logging method.
   */
  debug?: (...args: any[]) => void
  /**
   * Info level logging method.
   */
  info?: (...args: any[]) => void
  /**
   * Warn level logging method.
   */
  warn?: (...args: any[]) => void
  /**
   * Error level logging method.
   */
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
    async onRequest({ request }) {
      logger.info?.(`Request ${request.method} ${request.url}`)
      return request
    },
    async onResponse({ response }) {
      if (response.status >= 400) {
        logger.error?.('Response:', response.status, response.statusText)
      } else {
        logger.info?.('Response:', response.status, response.statusText)
      }

      return response
    },
  }
}
