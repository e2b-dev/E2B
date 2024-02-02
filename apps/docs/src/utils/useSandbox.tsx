import { Sandbox } from 'e2b'
import { create } from 'zustand'
import { docsSandboxName } from '@/utils/consts'

function log(message?: any, ...optionalParams: any[]) {
  if (process.env.NODE_ENV === 'production') return
  else console.log(message, optionalParams)
}

// const envIds = {
//   js: 'rki5dems9wqfm4r03t7g',
//   py: 'rki5dems9wqfm4r03t7g',
// }

// const preps = {
//   js: 'npm init es6 -y && npm install e2b',
//   py: 'pip install e2b',
// }

// TODO: Consider using immer for easier state updates
export const useSandboxStore = create<SandboxStore>((set, get) => ({
  sandbox: null,
  initSandbox: async (apiKey: string): Promise<Sandbox> => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const maybeExistingSandbox = get().sandbox
      if (maybeExistingSandbox?.sandbox) {
        log('Sandbox already ready')
        resolve(maybeExistingSandbox.sandbox)
        return
      } else if (maybeExistingSandbox?.promise) {
        log('Sandbox in progress, waiting...')
        await maybeExistingSandbox.promise
        resolve(maybeExistingSandbox.sandbox)
      } else {
        log('Sandbox creating...')
        try {
          const sandboxP = Sandbox.create({
            id: docsSandboxName,
            apiKey,
          })
          // set promise to store so that other calls to initSandbox will wait for this one to finish
          set((state) => ({
            sandbox: {
              ...state.sandbox,
              sandbox: null,
              promise: sandboxP,
            }
          }))
          const newSandbox = await sandboxP // await creation
          log('Sandbox created')
          // set sandbox to store, so it can be used instead of creating a new one
          set((state) => ({
            sandbox: {
              ...state.sandbox,
              sandbox: newSandbox,
            }
          }))
          resolve(newSandbox) // also resolve with the new sandbox for the initSandbox caller
        } catch (err) {
          console.info('Sandbox creation failed:', err)
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
  sandbox: SandboxMeta;
  initSandbox: (apiKey: string) => Promise<Sandbox>;
};
