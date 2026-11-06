import { ApiClient, components, handleApiError } from '../api'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'
import { TemplateError } from '../errors'
import { Paginator } from '../paginator'
import type { TemplateInfo, TemplateListOpts } from './types'

function convertTemplateInfo(
  template: components['schemas']['Template']
): TemplateInfo {
  return {
    templateId: template.templateID,
    buildId: template.buildID,
    names: template.names,
    ...(template.description && { description: template.description }),
    public: template.public,
    isDefault: template.isDefault ?? false,
    buildStatus: template.buildStatus,
    cpuCount: template.cpuCount,
    memoryMB: template.memoryMB,
    diskSizeMB: template.diskSizeMB,
    envdVersion: template.envdVersion,
    buildCount: template.buildCount,
    spawnCount: template.spawnCount,
    createdAt: new Date(template.createdAt),
    updatedAt: new Date(template.updatedAt),
    ...(template.lastSpawnedAt && {
      lastSpawnedAt: new Date(template.lastSpawnedAt),
    }),
  }
}

/**
 * Paginator for listing templates.
 *
 * @example
 * ```ts
 * const paginator = Template.list()
 * while (paginator.hasNext) {
 *   const templates = await paginator.nextItems()
 *   console.log(templates)
 * }
 * ```
 */
export class TemplatePaginator extends Paginator<TemplateInfo> {
  constructor(opts?: TemplateListOpts) {
    super(opts, opts?.limit, opts?.nextToken)
  }

  async nextItems(opts?: ConnectionOpts): Promise<TemplateInfo[]> {
    if (!this.hasNext) {
      throw new Error('No more items to fetch')
    }

    const apiOpts = ConnectionConfig.mergeOpts(this.opts, opts)
    const config = new ConnectionConfig(apiOpts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/v2/templates', {
      params: {
        query: {
          limit: this.limit,
          nextToken: this.nextToken,
        },
      },
      signal: config.getSignal(apiOpts?.requestTimeoutMs, apiOpts?.signal),
    })

    const err = handleApiError(res, TemplateError)
    if (err) {
      throw err
    }

    this.updatePagination(res.response)

    return (res.data ?? []).map(convertTemplateInfo)
  }
}
