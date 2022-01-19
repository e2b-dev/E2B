import { TemplateConfig } from 'src/common-ts/TemplateConfig'


// Normally, we would name this enum `TemplateID` but since this enum is exposed to users
// it makes more sense to name it `Env` because it's less confusing for users.
/**
 * Environments that you can use with the Devbook VM
 */
export enum Env {
  /**
  * Environment that supports executing JS code with NodeJS 16 runtime
  */
  NodeJS = 'nodejs-v16',
}

export const templates: { [key in Env]: TemplateConfig & { toCommand: (code: string) => string } } = {
  'nodejs-v16': {
    id: 'nodejs-v16',
    image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/nodejs-v16:latest',
    root_dir: '/home/runner',
    code_cells_dir: '/home/runner/src',
    toCommand: (code) => `node -e "${code}"`,
  },
}
