import { ApiClient, components, handleApiError } from '../api'
import { ConnectionConfig } from '../connectionConfig'
import { BasePaginator, SandboxApiOpts } from '../sandbox/sandboxApi'

/**
 * Information about a sandbox template.
 */
export interface TemplateInfo {
  /**
   * Identifier of the template.
   */
  templateId: string

  /**
   * Identifier of the last successful build for the template.
   */
  buildId: string

  /**
   * Number of CPUs the template is configured with.
   */
  cpuCount: number

  /**
   * Amount of memory in MiB the template is configured with.
   */
  memoryMB: number

  /**
   * Disk size of the template in MiB.
   */
  diskSizeMB: number

  /**
   * Whether the template is public or only accessible by the team.
   */
  public: boolean

  /**
   * Aliases of the template.
   *
   * @deprecated Use {@link TemplateInfo.names} instead.
   */
  aliases: string[]

  /**
   * Names of the template (namespace/alias format when namespaced).
   */
  names: string[]

  /**
   * Time when the template was created.
   */
  createdAt: Date

  /**
   * Time when the template was last updated.
   */
  updatedAt: Date

  /**
   * Time when the template was last used, or `null` if it was never used.
   */
  lastSpawnedAt: Date | null

  /**
   * Number of times a sandbox was spawned from the template.
   */
  spawnCount: number

  /**
   * Number of times the template was built.
   */
  buildCount: number

  /**
   * Version of envd the template was built with.
   */
  envdVersion: string

  /**
   * User who created the template, or `null` if not available.
   */
  createdBy: components['schemas']['TeamUser'] | null

  /**
   * Status of the last build for the template.
   */
  buildStatus: components['schemas']['TemplateBuildStatus']
}

/**
 * Options for listing templates.
 */
export interface TemplateListOpts extends Omit<SandboxApiOpts, 'signal'> {
  /**
   * Identifier of the team whose templates should be listed. Defaults to the
   * team the API key belongs to.
   */
  teamId?: string

  /**
   * Number of templates to return per page.
   *
   * @default 100
   */
  limit?: number

  /**
   * Token to the next page.
   */
  nextToken?: string
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
export class TemplatePaginator extends BasePaginator<TemplateInfo> {
  private readonly teamId?: string

  constructor(opts?: TemplateListOpts) {
    super(opts, opts?.limit, opts?.nextToken)

    this.teamId = opts?.teamId
  }

  async nextItems(opts?: SandboxApiOpts): Promise<TemplateInfo[]> {
    if (!this.hasNext) {
      throw new Error('No more items to fetch')
    }

    const config = new ConnectionConfig({ ...this.opts, ...opts })
    const client = new ApiClient(config)

    const res = await client.api.GET('/v2/templates', {
      params: {
        query: {
          teamID: this.teamId,
          limit: this.limit,
          nextToken: this.nextToken,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    this.updatePagination(res.response)

    return (res.data ?? []).map(
      (template: components['schemas']['Template']) => ({
        templateId: template.templateID,
        buildId: template.buildID,
        cpuCount: template.cpuCount,
        memoryMB: template.memoryMB,
        diskSizeMB: template.diskSizeMB,
        public: template.public,
        aliases: template.aliases ?? [],
        names: template.names ?? [],
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt),
        lastSpawnedAt: template.lastSpawnedAt
          ? new Date(template.lastSpawnedAt)
          : null,
        spawnCount: template.spawnCount,
        buildCount: template.buildCount,
        envdVersion: template.envdVersion,
        createdBy: template.createdBy ?? null,
        buildStatus: template.buildStatus,
      })
    )
  }
}
