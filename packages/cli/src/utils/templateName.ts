/**
 * Allowed template name (alias) format, matching the server-side validation in
 * e2b-dev/infra (`id.identifierRegex`): the name is trimmed and lowercased,
 * then must contain only lowercase letters, numbers, dashes and underscores.
 */
const templateNameRegex = /^[a-z0-9-_]+$/

const MAX_TEMPLATE_NAME_LENGTH = 128

export function validateTemplateName(name: string) {
  const cleaned = name?.trim()
  if (!cleaned) {
    throw new Error('Template name cannot be empty')
  }
  if (!templateNameRegex.test(cleaned)) {
    throw new Error(
      'Template name must contain only lowercase letters, numbers, dashes and underscores'
    )
  }
  if (cleaned.length > MAX_TEMPLATE_NAME_LENGTH) {
    throw new Error(
      `Template name must be at most ${MAX_TEMPLATE_NAME_LENGTH} characters long`
    )
  }
}
