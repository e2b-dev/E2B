import { Sandbox } from '@e2b/sdk'
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
  js: 'rki5dems9wqfm4r03t7g',
  py: 'rki5dems9wqfm4r03t7g',
}

const preps = {
  js: 'npm init es6 -y && npm install @e2b/sdk',
  py: 'pip install e2b',
}

// TODO: Consider using immer for easier state updates
export const useSandboxesStore = create<SandboxStore>((set, get) => ({
  sandboxes: {
    js: null,
    py: null,
  },
  initSandbox: async (lang: LangShort, apiKey: string): Promise<Sandbox> => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const maybeExistingSandbox = get().sandboxes[lang]
      if (maybeExistingSandbox?.sandbox) {
        log(`${lang} sandbox already ready`)
        resolve(maybeExistingSandbox.sandbox)
        return
      } else if (maybeExistingSandbox?.promise) {
        log(`${lang} sandbox in progress, waiting...`)
        await maybeExistingSandbox.promise
        resolve(maybeExistingSandbox.sandbox)
      } else {
        log(`${lang} sandbox creating...`)
        try {
          const sandboxP = Sandbox.create({ id: envIds[lang], apiKey })
          // set promise to store so that other calls to initSandbox will wait for this one to finish
          set((state) => ({
            sandboxes: {
              ...state.sandboxes,
              [lang]: {
                sandbox: null,
                promise: sandboxP,
              },
            },
          }))
          const newSandbox = await sandboxP // await creation
          log(`${lang} sandbox created, starting prep process...`)
          const proc = await newSandbox.process.start({
            cmd: preps[lang],
            onStdout: stdHandler,
            onStderr: stdHandler,
            cwd: '/code',
          })
          await proc.wait() // await prep process to finish
          log(`${lang} sandbox created and started`)
          // set sandbox to store, so it can be used instead of creating a new one
          set((state) => ({
            sandboxes: {
              ...state.sandboxes,
              [lang]: {
                sandbox: newSandbox,
                promise: null,
              },
            },
          }))
          resolve(newSandbox) // also resolve with the new sandbox for the initSandbox caller
        } catch (err) {
          console.info(`${lang} sandbox creation failed`, err)
          reject(err)
        }
      }
    })
  },
}))

type SandboxMeta = {
  sandbox: Sandbox;
  promise: Promise<Sandbox>;
};

export type SandboxStore = {
  sandboxes: {
    js: SandboxMeta;
    py: SandboxMeta;
  };
  initSandbox: (lang: LangShort, apiKey: string) => Promise<Sandbox>;
};
