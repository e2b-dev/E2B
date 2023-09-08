import { Session } from '@e2b/sdk'
import { create } from 'zustand'
import { LangShort } from '@/utils/consts'

function stdHandler({ line, timestamp, error }) {
  const timestampHumanFriendly = new Date(timestamp / 1000000) // timestamp is in nanoseconds
    .toISOString()
    .split('T')[1] // only time, date is not relevant for debugging
    .split('.')[0] // remove ms
  const emoji = error ? 'ERROR' : 'INFO'
  console.log(`☁️ ${timestampHumanFriendly} ${emoji} ${line}`)
}

const envIds = {
  js: 'Nodejs',
  py: 'Python3',
}

const preps = {
  js: `npm init es6 -y && npm install @e2b/sdk`,
  py: `pip install e2b`,
}

// TODO: Consider using immer for easier state updates
export const useSessionsStore = create<SessionsStore>((set, get) => ({
  sessions: {
    js: null,
    py: null,
  },
  initSession: async (lang: LangShort, apiKey: string): Promise<Session> => {
    return new Promise(async (resolve, reject) => {
      const maybeExistingSession = get().sessions[lang]
      if (maybeExistingSession?.session) {
        console.log(`${lang} session already ready`)
        resolve(maybeExistingSession.session)
        return
      } else if (maybeExistingSession?.promise) {
        console.log(`${lang} session in progress, waiting...`)
        await maybeExistingSession.promise
        resolve(maybeExistingSession.session)
      } else {
        console.log(`${lang} session creating...`)
        try {
          const sessionP = Session.create({ id: envIds[lang], apiKey })
          // set promise to store so that other calls to initSession will wait for this one to finish
          set((state) => ({
            sessions: {
              ...state.sessions,
              [lang]: {
                session: null,
                promise: sessionP,
              },
            },
          }))
          const newSession = await sessionP // await creation
          console.log(`${lang} session created, starting prep process...`)
          const proc = await newSession.process.start({
            cmd: preps[lang],
            onStdout: stdHandler,
            onStderr: stdHandler,
            rootdir: '/code',
          })
          await proc.finished // await prep process to finish
          console.log(`${lang} session created and started`)
          // set session to store so it can be used instead of creating a new one
          set((state) => ({
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
