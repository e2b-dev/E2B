import DocumentContext, { generateCodeCellID, getDefaultDocumentEnvID } from './documentContext/documentContext'
import { Template } from './constants'
import Runner from './runner'
import { makeIDGenerator } from '../utils/id'

const generateDocumentID = makeIDGenerator(4)

interface Opts {
  template: Template
  onStdout?: (stdout: string) => any
  onStderr?: (stderr: string) => any
  onCmdOut?: (out: { stdout: string | null, stderr: string | null }) => any
  onURLChange?: () => any
}

class DevbookEvaluator {
  private documentContext: DocumentContext
  private documentEnvID: string
  private codeCellID: string
  private executionID: string

  constructor(private opts: Opts) {
    if (!Runner.obj) throw new Error('Runner is not defined')
    this.documentContext = Runner.obj.initializeDocumentContext({ ...opts, documentID: 'default' })
    this.documentEnvID = getDefaultDocumentEnvID(opts.template)
    this.codeCellID = this.executionID = generateCodeCellID()
  }

  /* ==== Shell Code Cell === */
  createShellCodeCell(opts: {
    templateID: Template,
  }) {
    return this.documentContext?.createShellCodeCell(opts)
  }

  execShellCodeCell({ command }: { command: string }) {
    return this.documentContext?.execShellCodeCell({
      documentEnvID: this.documentEnvID,
      execID: this.executionID,
      command,
    })
  }
  /* ======== */

  /* ==== Code Cells ==== */
  createCodeCell(opts: {
    name?: string,
    initialCode?: string,
    templateID: Template,
  }) {
    return this.documentContext?.createCodeCell({
      ...opts,
      documentEnvID: this.documentEnvID,
      id: this.codeCellID,
    })
  }

  deleteCodeCell() {
    this.documentContext?.deleteCodeCell(this.codeCellID)
  }

  updateCodeCellCode(code: string) {
    this.documentContext?.updateCodeCellCode(this.codeCellID, code)
  }

  /* ======== */

  destroy() {
    this.documentContext.destroy()
  }

  createURL(port: number) {
    throw new Error('Not implemented')
  }
}

export default DevbookEvaluator
