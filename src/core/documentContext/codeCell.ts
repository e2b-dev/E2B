import { template } from '../constants'

export class EnvironmentCodeCell {
  readonly id: string

  name: string
  templateID: template.TemplateID
  documentEnvID?: string

  // No need for the `_code` variable to be reactive like `_id` and `_name` because
  // the actual code for a code cell is handled by CodeMirror. We just have to make
  // sure that a code cell instance has the latest version of the CodeMirror's
  // editor content. We don't need to react to the changes.
  code: string

  constructor({
    id,
    name,
    code = '',
    documentEnvID,
    templateID,
  }: {
    id: string,
    name: string,
    documentEnvID: string,
    templateID: template.TemplateID,
    code?: string,
  }) {
    this.id = id
    this.documentEnvID = documentEnvID
    this.name = name
    this.code = code
    this.templateID = templateID
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      templateID: this.templateID,
      documentEnvID: this.documentEnvID,
    }
  }
}
