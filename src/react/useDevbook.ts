import { useEffect, useState, useReducer, useCallback } from 'react'

import { DevbookEvaluator, Template } from '../core'

function useDevbook({
  template,
  port,
  code,
  name,
  isShellCommand,
  autorun,
}: {
  template: Template,
  port?: number,
  code: string,
  name?: string,
  isShellCommand?: boolean,
  autorun?: boolean,
}) {
  const [devbookEvaluator, setDevbookEvaluator] = useState<DevbookEvaluator>()
  const forceUpdate = useReducer(() => ({}), {})[1]

  const [stderr, setStderr] = useState<string[]>([])
  const [stdout, setStdout] = useState<string[]>([])
  const [cmdOuts, setCmdOuts] = useState<{ stderr: string | null, stdout: string | null }[]>([])

  const url = port && !isShellCommand && devbookEvaluator ? devbookEvaluator.createURL(port) : undefined

  const runCode = useCallback(() => {
    if (!devbookEvaluator) return

    if (isShellCommand) {
      setCmdOuts([])
      devbookEvaluator.execShellCodeCell({ command: code })
    } else {
      devbookEvaluator.updateCodeCellCode(code)
    }
  }, [
    code,
    devbookEvaluator,
    isShellCommand,
  ])

  useEffect(function handleCodeChange() {
    if (!autorun) return
    runCode()
  }, [autorun, runCode])

  useEffect(function initializeEvaluator() {
    const evaluator = new DevbookEvaluator({
      template,
      onStderr(stderr) {
        setStderr(s => [...s, stderr])
      },
      onStdout(stdout) {
        setStdout(s => [...s, stdout])
      },
      onCmdOut(cmdOut) {
        setCmdOuts(c => [...c, cmdOut])
      },
      onURLChange() {
        forceUpdate()
      },
    })

    evaluator.createCodeCell({
      name,
      initialCode: code,
      templateID: template,
    })

    setDevbookEvaluator(evaluator)
    return () => {
      evaluator.destroy()
    }
  }, [
    template,
    name,
  ])

  return {
    stderr,
    stdout,
    cmdOuts,
    url,
    runCode,
  }
}

export default useDevbook
