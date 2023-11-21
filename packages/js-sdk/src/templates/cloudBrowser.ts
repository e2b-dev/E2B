import { SandboxOpts } from '../sandbox'
import { BaseTemplate } from './baseTemplate'

const CloudBrowserTemplateId = 'CloudBrowser'

export class CloudBrowser extends BaseTemplate {
  constructor(opts: Omit<SandboxOpts, 'id'>) {
    super({ id: CloudBrowserTemplateId, ...opts })
  }

  static override async create(opts?: Omit<SandboxOpts, 'id'>) {
    return await new CloudBrowser({ ...opts })._create(opts)
  }

  // TODO: Copy python SDK functionalities

  async installJSPackages(packageNames: string | string[]) {
    await this.installPackages('npm install', packageNames)
  }
}
