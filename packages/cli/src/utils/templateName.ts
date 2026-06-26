/**
 * Check template name format
 */
function templateNameRegex(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/.test(name)
}

export function validateTemplateName(name: string) {
  if (!name || name.trim().length === 0) {
    throw new Error('Template name cannot be empty')
  }
  if (!templateNameRegex(name.trim())) {
    throw new Error(
      'Template name must contain only lowercase letters, numbers, hyphens, and underscores, and cannot start or end with a hyphen or underscore'
    )
  }
}
