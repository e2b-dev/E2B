import { ConnectionOpts } from './connectionConfig'
import { Sandbox } from './sandbox'
import { Secret } from './secret'
import { Template, TemplateBase } from './template'
import type {
  BuildOptions,
  GetBuildStatusOptions,
  TemplateClass,
  TemplateOptions,
} from './template/types'
import { Volume } from './volume'

function withDefaults<T extends object | undefined>(
  defaults: ConnectionOpts,
  opts: T
): T {
  return { ...defaults, ...opts } as T
}

function createBoundTemplate(defaults: ConnectionOpts): typeof Template {
  const boundTemplate = (options?: TemplateOptions) => Template(options)

  boundTemplate.build = ((
    template: TemplateClass,
    nameOrOptions: string | BuildOptions,
    options?: Omit<BuildOptions, 'alias'>
  ) =>
    typeof nameOrOptions === 'string'
      ? TemplateBase.build(template, nameOrOptions, {
          ...defaults,
          ...options,
        })
      : TemplateBase.build(template, {
          ...defaults,
          ...nameOrOptions,
        })) as typeof TemplateBase.build

  boundTemplate.buildInBackground = ((
    template: TemplateClass,
    nameOrOptions: string | BuildOptions,
    options?: Omit<BuildOptions, 'alias'>
  ) =>
    typeof nameOrOptions === 'string'
      ? TemplateBase.buildInBackground(template, nameOrOptions, {
          ...defaults,
          ...options,
        })
      : TemplateBase.buildInBackground(template, {
          ...defaults,
          ...nameOrOptions,
        })) as typeof TemplateBase.buildInBackground

  boundTemplate.getBuildStatus = (
    data: Parameters<typeof TemplateBase.getBuildStatus>[0],
    options?: GetBuildStatusOptions
  ) => TemplateBase.getBuildStatus(data, withDefaults(defaults, options))

  boundTemplate.exists = (name: string, options?: ConnectionOpts) =>
    TemplateBase.exists(name, withDefaults(defaults, options))

  boundTemplate.aliasExists = (alias: string, options?: ConnectionOpts) =>
    TemplateBase.aliasExists(alias, withDefaults(defaults, options))

  boundTemplate.assignTags = (
    targetName: string,
    tags: string | string[],
    options?: ConnectionOpts
  ) =>
    TemplateBase.assignTags(targetName, tags, withDefaults(defaults, options))

  boundTemplate.removeTags = (
    name: string,
    tags: string | string[],
    options?: ConnectionOpts
  ) => TemplateBase.removeTags(name, tags, withDefaults(defaults, options))

  boundTemplate.getTags = (templateId: string, options?: ConnectionOpts) =>
    TemplateBase.getTags(templateId, withDefaults(defaults, options))

  boundTemplate.toJSON = TemplateBase.toJSON
  boundTemplate.toDockerfile = TemplateBase.toDockerfile

  return boundTemplate
}

/**
 * E2B client holding its own connection configuration.
 *
 * The classes exposed on a client instance behave exactly like the top-level
 * exports, except that the client's connection options are used as defaults
 * for every API call. Per-call options still take precedence.
 *
 * The top-level `Sandbox`, `Volume`, `Secret` and `Template` exports keep
 * using the configuration from environment variables.
 *
 * @example
 * ```ts
 * import E2B from 'e2b'
 *
 * const { Sandbox, Volume, Secret } = new E2B({ apiKey: 'e2b_...' })
 *
 * const sandbox = await Sandbox.create()
 * ```
 */
export class E2B {
  /**
   * {@link Sandbox} bound to this client's connection options.
   */
  readonly Sandbox: typeof Sandbox

  /**
   * {@link Volume} bound to this client's connection options.
   */
  readonly Volume: typeof Volume

  /**
   * {@link Secret} — stateless, exposed for convenience so a client can be
   * destructured the same way as the top-level exports.
   */
  readonly Secret: typeof Secret

  /**
   * {@link Template} builder bound to this client's connection options.
   */
  readonly Template: typeof Template

  constructor(opts?: ConnectionOpts) {
    const defaults: ConnectionOpts = { ...opts }

    this.Sandbox = class extends Sandbox {
      protected static override defaultConnectionOpts = defaults
    }

    this.Volume = class extends Volume {
      protected static override defaultConnectionOpts = defaults
    }

    this.Secret = Secret

    this.Template = createBoundTemplate(defaults)
  }
}
