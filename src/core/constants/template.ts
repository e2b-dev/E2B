import { TemplateConfig } from '../../common-ts/TemplateConfig'

export enum Template {
  NextJS = 'nextjs-v11-components',
  NodeJS = 'nodejs-v16',
}

export const templates: { [key in Template]: TemplateConfig } = {
  [Template.NextJS]: {
    'id': 'nextjs-v11-components',
    'image': 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/nextjs-v11-components:latest',
    'root_dir': '/home/runner',
    'code_cells_dir': '/home/runner/pages'
  },
  [Template.NodeJS]: {
    'id': 'nodejs-v16',
    'image': 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/nodejs-v16:latest',
    'root_dir': '/home/runner',
    'code_cells_dir': '/home/runner/src'
  },
}
