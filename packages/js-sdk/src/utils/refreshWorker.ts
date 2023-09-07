import { SESSION_DOMAIN, SESSION_REFRESH_PERIOD } from '../constants'
import wait from './wait'

// import api from '../api'
// const refreshSession = api
//   .path('/sessions/{sessionID}/refresh')
//   .method('post')
//   .create({ api_key: true })

addEventListener('message', async ev => {
  const [sessionID, apiKey] = ev.data as [string, string]
  // console.log(`🤠 Worker init "${sessionID}"`)
  try {
    while (true) {
      await wait(SESSION_REFRESH_PERIOD)
      try {
        postMessage({
          action: 'log',
          args: [`Refreshing session "${sessionID}"`],
        })

        // await refreshSession({ api_key: apiKey, sessionID })
        await fetch(
          `https://${SESSION_DOMAIN}/sessions/${sessionID}/refresh?api_key=${apiKey}`,
          {
            body: '{}',
            headers: {
              // package_version: 'TODO',
              // lang: 'TODO',
              // engine: 'TODO',
              // lang_version: 'TODO',
              // system: 'TODO',
              // publisher: 'TODO',
            },
            method: 'POST',
          },
        )
      } catch (err) {
        // if (err instanceof refreshSession.Error) {
        //   const error = err.getActualType()
        //   if (error.status === 404) {
        //     // postMessage('log', 'warn', `Error refreshing session - (${error.status}): ${error.data.message}`)
        //     return
        //   }
        //   // postMessage('log', 'warn', `Refreshing session "${sessionID}" failed - (${error.status})`)
        // }
        // TODO: Handle errors
        throw err
      }
    }
  } finally {
    postMessage({
      action: 'log',
      args: [`debug`, `Stopped refreshing session "${sessionID}"`],
    })
    postMessage({
      action: 'close',
    })
  }
})
