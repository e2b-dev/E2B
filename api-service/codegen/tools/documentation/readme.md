# [![Itty Router](https://user-images.githubusercontent.com/865416/146679767-16be95b4-5dd7-4bcf-aed7-b8aa8c828f48.png)](https://itty-router.dev)

## Usage
### 1. Create a Router
```js
import { Router } from 'itty-router'

const router = Router() // no "new", as this is not a real class
```

### 2. Register Route(s)
##### `router.{method}(route: string, handler1: function, handler2: function, ...)`
```js
// register a route on the "GET" method
router.get('/todos/:user/:item?', (req) => {
  const { params, query } = req

  console.log({ params, query })
})
```

### 3. Handle Incoming Request(s)
##### `async router.handle(request.proxy: Proxy || request: Request, ...anything else) => Promise<any>`
Requests (doesn't have to be a real Request class) should have both a **method** and full **url**.
The `handle` method will then return a Promise, resolving with the first matching route handler that returns something (or nothing at all if no match).

```js
router.handle({
  method: 'GET',                              // required
  url: 'https://example.com/todos/jane/13',   // required
})
```

#### A few notes about this:
- **Error Handling:** By default, there is no error handling built in to itty.  However, the handle function is async, allowing you to add a `.catch(error)` like this:

  ```js
  import { Router } from 'itty-router'

  // a generic error handler
  const errorHandler = error =>
    new Response(error.message || 'Server Error', { status: error.status || 500 })

  // add some routes (will both safely trigger errorHandler)
  router
    .get('/accidental', request => request.that.will.throw)
    .get('/intentional', () => {
      throw new Error('Bad Request')
    })

  // attach the router "handle" to the event handler
  addEventListener('fetch', event =>
    event.respondWith(
      router
        .handle(event.request)
        .catch(errorHandler)
    )
  )
  ```
- **Extra Variables:** The router handle expects only the request itself, but passes along any additional params to the handlers/middleware.  For example, to access the `event` itself within a handler (e.g. for `event.waitUntil()`), you could simply do this:

  ```js
  const router = Router()

  router.get('/long-task', (request, event) => {
    event.waitUntil(longAsyncTaskPromise)

    return new Response('Task is still running in the background!')
  })

  addEventListener('fetch', event =>
    event.respondWith(router.handle(event.request, event))
  )
  ```
- **Proxies:** To allow for some pretty incredible middleware hijacks, we pass `request.proxy` (if it exists) or `request` (if not) to the handler.  This allows middleware to set `request.proxy = new Proxy(request.proxy || request, {})` and effectively take control of reads/writes to the request object itself.  As an example, the `withParams` middleware in `itty-router-extras` uses this to control future reads from the request.  It intercepts "get" on the Proxy, first checking the requested attribute within the `request.params` then falling back to the `request` itself.

## Examples

### File format support
```js
// GET item with optional format/extension
router.get('/todos/:id.:format?', request => {
  const { id, format = 'csv' } = request.params

  return new Response(`Getting todo #${id} in ${format} format.`)
})
```

### Cloudflare ES6 Module Syntax (required for Durable Objects) <a id="cf-es6-module-syntax"></a>
See https://developers.cloudflare.com/workers/runtime-apis/fetch-event#syntax-module-worker
```js
import { Router } from 'itty-router'

const router = Router()

router.get('/', (request, env, context) => {
  // now have access to the env (where CF bindings like durables, KV, etc now are)
})

export default {
  fetch: router.handle // yep, it's this easy.
}

// alternative advanced/manual approach for downstream control
export default {
  fetch: (request, env, context) => router
                                      .handle(request, env, context)
                                      .then(response => {
                                        // can modify response here before final return, e.g. CORS headers

                                        return response
                                      })
                                      .catch(err => {
                                        // and do something with the errors here, like logging, error status, etc
                                      })
}
```
