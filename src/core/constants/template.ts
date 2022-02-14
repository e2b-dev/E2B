import { TemplateConfig } from '../../common-ts/TemplateConfig'


// Normally, we would name this enum `TemplateID` but since this enum is exposed to users
// it makes more sense to name it `Env` because it's less confusing for users.
/**
 * Runtime environments that you can use with the Devbooks' VMs.
 */
export enum Env {
  /**
   * Runtime environment that uses NextJS server with hot-reloading.
   */
  NextJS = 'nextjs-v11-components',
  /**
   * Runtime environment that supports executing JS code with NodeJS 16 runtime.
   */
  NodeJS = 'nodejs-v16',
  /**
   * Runtime environment for the Banana Node API.
   */
  BananaNode = 'banana-node',
  /**
   * Runtime environment for the Banana Python API.
   */
  BananaPython = 'banana-python',
  // /**
  //  * Runtime environment for the Supabase demo.
  //  */
  // Supabase = 'supabase',

  // /**
  //  * Runtime environment for the Buildspace demo.
  //  */
  // BuildspaceSolidity = 'buildspace-solidity',

  /**
   * Runtime environment for the Thirdweb demo.
   */
  ThirdwebNode = 'thirdweb-node',
}

export const templates: { [key in Env]: TemplateConfig & { toCommand?: (code: string) => string, fileExtension: string } } = {
  [Env.NodeJS]: {
    id: 'nodejs-v16',
    fileExtension: '.js',
    image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/nodejs-v16:latest',
    root_dir: '/home/runner',
    code_cells_dir: '/home/runner/src',
    toCommand: (filepath: string) => `node "${filepath}"`,
  },
  [Env.NextJS]: {
    id: 'nextjs-v11-components',
    fileExtension: '.tsx',
    image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/nextjs-v11-components',
    root_dir: '/home/runner',
    code_cells_dir: '/home/runner/src',
  },
  [Env.BananaNode]: {
    id: 'banana-node',
    fileExtension: '.js',
    image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/banana-node',
    root_dir: '/home/runner',
    code_cells_dir: '/home/runner/src',
  },
  [Env.BananaPython]: {
    id: 'banana-python',
    fileExtension: '.py',
    image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/banana-python',
    root_dir: '/home/runner',
    code_cells_dir: '/home/runner',
  },
  // [Env.Supabase]: {
  //   id: 'supabase',
  //   fileExtension: '.js',
  //   image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/supabase',
  //   root_dir: '/home/runner',
  //   code_cells_dir: '/home/runner/src',
  //   toCommand: (filepath: string) => `node "${filepath}"`,
  // },
  // [Env.BuildspaceSolidity]: {
  //   id: 'buildspace-solidiity',
  //   fileExtension: '.sol',
  //   image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/buildspace-solidity',
  //   root_dir: '/home/runner',
  //   code_cells_dir: '/home/runner',
  // },
  [Env.ThirdwebNode]: {
    id: 'thirdweb-node',
    fileExtension: '.ts',
    image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/thirdweb-node',
    root_dir: '/home/runner',
    code_cells_dir: '/home/runner',
    toCommand: (filepath: string) => `npx ts-node "${filepath}"`,
  },
}
