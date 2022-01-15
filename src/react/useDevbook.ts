import { DevbookEvaluator, Template } from '../core'
import { useEffect, useState, useReducer } from 'react'

function useDevbook({ template }: { template: Template }) {
  const [devbookEvaluator, setDevbookEvaluator] = useState<DevbookEvaluator>()
  const forceUpdate = useReducer(() => ({}), {})[1]

  useEffect(function initializeEvaluator() {
    const evaluator = new DevbookEvaluator({
      template,
      onStderr(stderr) {
        forceUpdate()
      },
      onStdout(stdout) {
        forceUpdate()
      },
      onCmdOut(cmdOut) {
        forceUpdate()
      },
      onURLChange() {
        const url = evaluator.createURL(3000)
        forceUpdate()
      },
    })
    setDevbookEvaluator(evaluator)
    return () => {
      evaluator.destroy()
    }
  }, [template])

  return devbookEvaluator
}

export default useDevbook
