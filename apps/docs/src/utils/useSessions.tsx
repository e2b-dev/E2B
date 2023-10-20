import { Session } from '@e2b/sdk'
import { create } from 'zustand'
import { LangShort } from '@/utils/consts'

function stdHandler({ line, timestamp, error }) {
  if (process.env.NODE_ENV === 'production') return

  const timestampHumanFriendly = new Date(timestamp / 1000000) // timestamp is in nanoseconds
    .toISOString()
    .split('T')[1] // only time, date is not relevant for debugging
    .split('.')[0] // remove ms
  const emoji = error ? '\x1B[31mERROR' : '\x1B[34mINFO'
  console.log(`☁️ ${timestampHumanFriendly} ${emoji} ${line}`)
}

function log(message?: any, ...optionalParams: any[]) {
  if (process.env.NODE_ENV === 'production') return
  else console.log(message, optionalParams)
}

const envIds = {
  js: 'Nodejs',
  py: 'Python3',
}

const preps = {
  js: 'npm init es6 -y && npm install @e2b/sdk',
  py: 'pip install e2b',
}

// TODO: Consider using immer for easier state updates
export const useSessionsStore = create<SessionsStore>((set, get) => ({
  sessions: {
    js: null,
    py: null,
  },
  initSession: async (lang: LangShort, apiKey: string): Promise<Session> => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const maybeExistingSession = get().sessions[lang]
      if (maybeExistingSession?.session) {
        log(`${lang} session already ready`)
        resolve(maybeExistingSession.session)
        return
      } else if (maybeExistingSession?.promise) {
        log(`${lang} session in progress, waiting...`)
        await maybeExistingSession.promise
        resolve(maybeExistingSession.session)
      } else {
        log(`${lang} session creating...`)
        try {
          const sessionP = Session.create({ id: envIds[lang], apiKey })
          // set promise to store so that other calls to initSession will wait for this one to finish
          set(state => ({
            sessions: {
              ...state.sessions,
              [lang]: {
                session: null,
                promise: sessionP,
              },
            },
          }))
          const newSession = await sessionP // await creation
          log(`${lang} session created, starting prep process...`)
          const proc = await newSession.process.start({
            cmd: preps[lang],
            onStdout: stdHandler,
            onStderr: stdHandler,
            cwd: '/code',
          })
          await proc.wait() // await prep process to finish
          log(`${lang} session created and started`)
          // set session to store, so it can be used instead of creating a new one
          set(state => ({
            sessions: {
              ...state.sessions,
              [lang]: {
                session: newSession,
                promise: null,
              },
            },
          }))
          resolve(newSession) // also resolve with the new session for the initSession caller
        } catch (err) {
          console.info(`${lang} session creation failed`, err)
          reject(err)
        }
      }
    })
  },
}))

type SessionMeta = {
  session: Session
  promise: Promise<Session>
}

export type SessionsStore = {
  sessions: {
    js: SessionMeta
    py: SessionMeta
  }
  initSession: (lang: LangShort, apiKey: string) => Promise<Session>
}
