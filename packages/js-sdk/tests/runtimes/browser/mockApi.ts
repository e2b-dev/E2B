import type { RequestHandler } from 'msw'
import { setupWorker } from 'msw/browser'

import type { MockApi } from '../../mockApi'

/**
 * Browser implementation of tests/mockApi.ts, served in place of it by the
 * browser config. Requests are intercepted by a Service Worker registered
 * from `/mockServiceWorker.js`, which the config serves straight out of the
 * installed `msw` package so the script can't fall out of step with the
 * library.
 *
 * The worker is shared by every test file (one registration per origin), but
 * it only intercepts for clients that have called `start()`, and vitest runs
 * each file in its own iframe — so a suite's handlers never see another
 * suite's traffic.
 */
export function setupMockApi(...handlers: RequestHandler[]): MockApi {
  const worker = setupWorker(...handlers)

  return {
    async listen(options) {
      // `quiet` drops msw's per-request console group, which vitest would
      // otherwise forward to the terminal for every mocked call.
      await worker.start({ ...options, quiet: true })
    },
    async close() {
      worker.stop()
    },
    use: (...next) => worker.use(...next),
    resetHandlers: (...next) => worker.resetHandlers(...next),
    events: worker.events,
  }
}
