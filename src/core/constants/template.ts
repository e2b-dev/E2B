import { TemplateConfig } from '../../common-ts/TemplateConfig'

export enum TemplateID {
  NextJS = 'nextjs-v11-components',
  NodeJS = 'nodejs-v16',
}

export const templates: { [key in TemplateID]: TemplateConfig } = {
  [TemplateID.NextJS]: {
    'id': 'nextjs-v11-components',
    'image': 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/nextjs-v11-components:latest',
    'root_dir': '/home/runner',
    'code_cells_dir': '/home/runner/pages'
  },
  [TemplateID.NodeJS]: {
    'id': 'nodejs-v16',
    'image': 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/nodejs-v16:latest',
    'root_dir': '/home/runner',
    'code_cells_dir': '/home/runner/src'
  },
}
