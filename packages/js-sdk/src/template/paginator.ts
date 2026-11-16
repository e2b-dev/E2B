import { ApiClient, handleApiError } from '../api'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'
import {
  InvalidArgumentError,
  TemplateError,
  TemplateNotFoundError,
} from '../errors'
import { Paginator } from '../paginator'
import { isTemplateNotFound, validateNameOrIdWithoutTag } from './utils'
import {
  convertTemplateBuildWithTags,
  convertTemplateInfo,
  TEMPLATE_BUILD_STATUSES,
} from './types'
import type {
  TemplateBuildListOpts,
  TemplateBuildStatus,
  TemplateBuildWithTags,
  TemplateInfo,
  TemplateListOpts,
} from './types'

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

/**
 * Paginator for listing the builds of a template, newest first.
 *
 * @example
 * ```ts
 * const paginator = Template.listBuilds('my-template')
 * while (paginator.hasNext) {
 *   const builds = await paginator.nextItems()
 *   console.log(builds)
 * }
 * ```
 */
export class TemplateBuildPaginator extends Paginator<TemplateBuildWithTags> {
  private readonly nameOrId: string
  private readonly statuses: TemplateBuildStatus[]
  private readonly tags: string[]

  constructor(nameOrId: string, opts?: TemplateBuildListOpts) {
    super(opts, opts?.limit, opts?.nextToken)

    validateNameOrIdWithoutTag(nameOrId)
    // `/templates/aliases/...` is another API route, the alias check.
    if (nameOrId === 'aliases') {
      throw new InvalidArgumentError(
        "A template named 'aliases' must be given by its ID or by its name with the team prefix, such as 'my-team/aliases'."
      )
    }
    this.nameOrId = nameOrId

    // Each filter takes one value or a list, and is copied so that a later
    // change to the caller's list does not change the pages still to come.
    // A status given twice is sent once: the API refuses repeated statuses.
    this.statuses = [...new Set([opts?.statuses ?? []].flat())]
    this.tags = [opts?.tags ?? []].flat()

    for (const status of this.statuses) {
      if (!TEMPLATE_BUILD_STATUSES.includes(status)) {
        throw new InvalidArgumentError(
          `Unknown build status '${status}', expected one of: ${TEMPLATE_BUILD_STATUSES.join(', ')}.`
        )
      }
    }

    // Tags are sent as one comma-separated value, so an empty tag or one
    // with a comma would not reach the API as the tag that was given.
    for (const tag of this.tags) {
      if (/^[ \t\n\r\f\v]*$/.test(tag) || tag.includes(',')) {
        throw new InvalidArgumentError(
          `Invalid tag '${tag}': a tag must not be empty or contain a comma.`
        )
      }
    }
  }

  async nextItems(opts?: ConnectionOpts): Promise<TemplateBuildWithTags[]> {
    if (!this.hasNext) {
      throw new Error('No more items to fetch')
    }

    const apiOpts = ConnectionConfig.mergeOpts(this.opts, opts)
    const config = new ConnectionConfig(apiOpts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/templates/{templateID}/builds', {
      params: {
        path: {
          templateID: this.nameOrId,
        },
        query: {
          limit: this.limit,
          nextToken: this.nextToken,
          statuses: this.statuses,
          tags: this.tags,
        },
      },
      signal: config.getSignal(apiOpts?.requestTimeoutMs, apiOpts?.signal),
    })

    if (isTemplateNotFound(res.error)) {
      throw new TemplateNotFoundError(`Template '${this.nameOrId}' not found`)
    }

    const err = handleApiError(res, TemplateError)
    if (err) {
      throw err
    }

    this.updatePagination(res.response)

    return (res.data ?? []).map(convertTemplateBuildWithTags)
  }
}
