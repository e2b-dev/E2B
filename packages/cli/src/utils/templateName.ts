import { z } from 'zod'

import { zodParser } from '../validation'

const MAX_TEMPLATE_NAME_LENGTH = 128

/**
 * Template name (alias), normalized like the server-side validation in
 * e2b-dev/runtime (`id.identifierRegex`): trimmed and lowercased, then only
 * lowercase letters, numbers, dashes and underscores.
 */
export const templateNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Template name cannot be empty.')
  .regex(
    /^[a-z0-9-_]+$/,
    'Template name must contain only letters, numbers, dashes and underscores.'
  )
  .max(
    MAX_TEMPLATE_NAME_LENGTH,
    `Template name must be at most ${MAX_TEMPLATE_NAME_LENGTH} characters long.`
  )

export const parseTemplateName = zodParser(templateNameSchema)
