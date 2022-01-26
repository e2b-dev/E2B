import { TemplateConfig } from 'src/common-ts/TemplateConfig'


// Normally, we would name this enum `TemplateID` but since this enum is exposed to users
// it makes more sense to name it `Env` because it's less confusing for users.
/**
 * Runtime environments that you can use with the Devbooks' VMs.
 */
export enum Env {
  /**
  * Runtime environment that supports executing JS code with NodeJS 16 runtime.
  */
  NodeJS = 'nodejs-v16',
  Supabase = 'supabase',
}

export const templates: { [key in Env]: TemplateConfig & { toCommand: (code: string) => string, fileExtension: string } } = {
  'nodejs-v16': {
    id: 'nodejs-v16',
    fileExtension: '.js',
    image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/nodejs-v16:latest',
    root_dir: '/home/runner',
    code_cells_dir: '/home/runner/src',
    toCommand: (filepath: string) => `node "${filepath}"`,
  },
  'supabase': {
    id: 'supabase',
    fileExtension: '.js',
    image: 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/supabase',
    root_dir: '/home/runner',
    code_cells_dir: '/home/runner/src',
    toCommand: (filepath: string) => `node "${filepath}"`,
  },
}
