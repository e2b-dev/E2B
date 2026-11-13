import type { RequestHandler, SharedOptions } from 'msw'
import { setupServer, type SetupServer } from 'msw/node'

/**
 * A mocked E2B API for the unit suites that don't talk to a real backend.
 *
 * The handlers are plain msw and run everywhere; only the interception does
 * not. Node — and the runtimes with a Node compatibility layer — patch the
 * HTTP clients in-process through `msw/node`, whose entry pulls in
 * `node:http`. A browser can't load that and intercepts at the network layer
 * instead, through a Service Worker from `msw/browser`; the browser config
 * swaps in tests/runtimes/browser/mockApi.ts for this module. Both expose
 * this shape, so a suite written against it runs on every leg unchanged.
 */
export interface MockApi {
  /**
   * Starts intercepting requests. Async because a browser has to register
   * and activate the worker first; on Node it resolves immediately.
   */
  listen(options?: SharedOptions): Promise<void>
  /** Stops intercepting requests. */
  close(): Promise<void>
  /** Prepends handlers to the active list until the next `resetHandlers`. */
  use: SetupServer['use']
  /** Restores the initial handlers, or replaces them when some are given. */
  resetHandlers: SetupServer['resetHandlers']
  /** Life-cycle events, e.g. `request:start`. */
  events: SetupServer['events']
}

export function setupMockApi(...handlers: RequestHandler[]): MockApi {
  const server = setupServer(...handlers)

  return {
    async listen(options) {
      server.listen(options)
    },
    async close() {
      server.close()
    },
    use: (...next) => server.use(...next),
    resetHandlers: (...next) => server.resetHandlers(...next),
    events: server.events,
  }
}
