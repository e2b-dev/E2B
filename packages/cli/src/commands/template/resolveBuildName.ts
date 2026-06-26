import * as e2b from 'e2b'

import { client } from '../../api'
import { E2BConfig } from '../../config'
import { getUserConfig } from '../../user'
import { sortTemplatesAliases } from '../../utils/templateSort'

function getTemplateNames(
  template: Pick<
    e2b.components['schemas']['TemplateWithBuilds'],
    'names' | 'aliases'
  >
): string[] {
  if (template.names?.length) {
    return template.names
  }
  return template.aliases ?? []
}

function looksLikeOpaqueTemplateId(templateId: string): boolean {
  return /^[a-z0-9]{10,}$/i.test(templateId) && !templateId.includes('-')
}

function warnTemplateIdFallback(templateId: string, reason: string) {
  if (!looksLikeOpaqueTemplateId(templateId)) {
    return
  }

  console.warn(`\n⚠️  ${reason}`)
  console.warn(
    '   Set template_name in e2b.toml, pass --alias, or run `e2b auth login` so the CLI can resolve the alias from your account.\n'
  )
}

/**
 * Resolve the human-readable template name used in generated build scripts.
 * `AsyncTemplate.build` / `Template.build` expect an alias, not the opaque template ID.
 */
export async function resolveTemplateBuildName(
  config: E2BConfig,
  opts?: { alias?: string }
): Promise<string> {
  if (config.template_name) {
    return config.template_name
  }

  if (opts?.alias) {
    return opts.alias
  }

  const apiKey = process.env.E2B_API_KEY || getUserConfig()?.teamApiKey
  if (!apiKey) {
    warnTemplateIdFallback(
      config.template_id,
      'e2b.toml has template_id but no template_name. Generated build_prod.py will use the template ID as the build name, which may fail with a 409 alias collision when rebuilding an existing template.'
    )
    return config.template_id
  }

  const res = await client.api.GET('/templates/{templateID}', {
    params: {
      path: {
        templateID: config.template_id,
      },
      query: {
        limit: 1,
      },
    },
  })

  if (res.error || !res.data) {
    warnTemplateIdFallback(
      config.template_id,
      `Could not resolve template alias for template_id "${config.template_id}" (${res.error?.message ?? 'unknown error'}). Falling back to template_id in generated build scripts.`
    )
    return config.template_id
  }

  const names = getTemplateNames(res.data)
  if (!names.length) {
    warnTemplateIdFallback(
      config.template_id,
      `Template "${config.template_id}" has no aliases. Falling back to template_id in generated build scripts.`
    )
    return config.template_id
  }

  sortTemplatesAliases(names)
  return names[0]
}
