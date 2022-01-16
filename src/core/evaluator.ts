import { makeIDGenerator } from 'src/utils/id'

import DocumentContext, { generateCodeCellID, getDefaultDocumentEnvID } from './documentContext/documentContext'
import { Template } from './constants'
import Runner from './runner'

const generateDocumentID = makeIDGenerator(4)

interface Opts {
  template: Template
  onStdout?: (stdout: string) => any
  onStderr?: (stderr: string) => any
  onCmdOut?: (out: { stdout: string | null, stderr: string | null }) => any
  onURLChange?: () => any
}

class Evaluator {
  private documentContext: DocumentContext
  private documentEnvID: string
  private codeCellID: string
  private executionID: string

  constructor(private opts: Opts) {
    if (!Runner.obj) throw new Error('Runner is not defined')

    this.documentEnvID = getDefaultDocumentEnvID(opts.template)
    const codeCellID = generateCodeCellID()
    const executionID = generateCodeCellID()
    this.codeCellID = codeCellID
    this.executionID = executionID

    this.documentContext = Runner.obj.initializeDocumentContext({
      documentID: 'default',
      onURLChange: opts.onURLChange,
      onCmdOut(payload) {
        if (payload.executionID !== executionID) return
        const out = {
          stdout: payload.stdout ?? null,
          stderr: payload.stderr ?? null,
        }
        opts.onCmdOut?.(out)
      },
      onStderr(payload) {
        opts.onStderr?.(payload.message)
      },
      onStdout(payload) {
        opts.onStdout?.(payload.message)
      },
    })
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
    const sessionID = Runner.obj?.session?.id
    const env = this.documentContext.runningEnvs.find(e => e.documentEnvID === this.documentEnvID)
    const codeCell = this.documentContext.codeCells.find(cc => cc.id === this.codeCellID)
    if (!env || !sessionID || !codeCell) return
    return `https://${port}-${env.id}-${sessionID}.o.usedevbook.com/${codeCell.name}`
  }
}

export default Evaluator
