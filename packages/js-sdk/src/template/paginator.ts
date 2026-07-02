import { ApiClient, components, handleApiError } from '../api'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'
import { TemplateError } from '../errors'
import { Paginator } from '../paginator'
import { TemplateInfo, TemplateListOpts } from './types'

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
export class TemplatePaginator extends Paginator<TemplateInfo, ConnectionOpts> {
  constructor(opts?: TemplateListOpts) {
    super(opts, opts?.limit, opts?.nextToken)
  }

  async nextItems(opts?: ConnectionOpts): Promise<TemplateInfo[]> {
    // An exhausted paginator returns an empty list rather than throwing. The
    // sandbox and snapshot paginators currently throw here instead; they'll be
    // aligned to this behaviour.
    if (!this.hasNext) {
      return []
    }

    const config = new ConnectionConfig({ ...this.opts, ...opts })
    const client = new ApiClient(config)

    const res = await client.api.GET('/v2/templates', {
      params: {
        query: {
          limit: this.limit,
          nextToken: this.nextToken,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    const err = handleApiError(res, TemplateError)
    if (err) {
      throw err
    }

    this.updatePagination(res.response)

    return (res.data ?? []).map(
      ({
        templateID,
        buildID,
        createdAt,
        updatedAt,
        lastSpawnedAt,
        ...rest
      }: components['schemas']['Template']) => ({
        ...rest,
        templateId: templateID,
        buildId: buildID,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
        lastSpawnedAt: lastSpawnedAt ? new Date(lastSpawnedAt) : null,
      })
    )
  }
}
