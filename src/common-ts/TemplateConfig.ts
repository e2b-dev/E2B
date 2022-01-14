/**
 * `TemplateConfig` corresponds to the `GetTemplates_templates` type from the GraphQL endpoint,
 * but we cannot include it in the `common-ts` directly, because it is generated to a separate file.
 */
export interface TemplateConfig {
  id: string
  /**
   * Path to this template's Docker image in a public container repository.
   */
  image: string
  /**
   * Absolute path where we will mount the host's volume and where we will be installing dependencies for the code cells.
   */
  root_dir: string
  /**
   * Absolute path to the subdirectory of the `root_dir`, where we will save code cell files.
   */
  code_cells_dir: string
}
