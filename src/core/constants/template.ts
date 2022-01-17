import { TemplateConfig } from '../../common-ts/TemplateConfig'

export type TemplateID = 'nodejs-v16'

export const templates: { [key in TemplateID]: TemplateConfig & { command: string } } = {
  'nodejs-v16': {
    'id': 'nodejs-v16',
    'image': 'us-central1-docker.pkg.dev/devbookhq/devbook-runner-templates/nodejs-v16:latest',
    'root_dir': '/home/runner',
    'code_cells_dir': '/home/runner/src',
    'command': 'node -e ',
  },
}
