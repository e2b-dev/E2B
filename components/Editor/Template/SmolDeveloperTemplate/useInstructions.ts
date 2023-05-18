import { useCallback, useEffect } from 'react'

import { useStateStore } from 'state/StoreProvider'

export interface InstructionsInfo {
  Description: string
  RepoURL: string
}

/**
 * This hook is specific for the template.
 * 
 * Because the structure of instructions (the text/prompt that user specifies before generating the code with "Run")
 * in each template could be completely different (sometimes you need array of routes, othertime you just need few fields)
 * we let the template specific hooks handle this and expose just an `any` object from `instructions`.
 */
function useInstructions(): {
  RepoURL: string,
  Description: string,
  setRepoURL: (url: string) => void,
  setDescription: (description: string) => void,
} {
  const [selectors] = useStateStore()
  const setInstructions = selectors.use.setInstructions()
  const setInstructionTransform = selectors.use.setInstructionTransform()
  const instructions = selectors.use.instructions()

  const RepoURL = instructions?.['RepoURL'] as string | undefined
  const Description = instructions?.['Description'] as string | undefined

  // Define which fields saved in instructions are in XML format and need to be transfomed before constructing prompt
  // Use format from https://github.com/JSONPath-Plus/JSONPath#syntax-through-examples
  useEffect(function setInstructionsTransform() {
    setInstructionTransform('$.[Instructions]', { type: 'xml' })
  }, [setInstructionTransform])

  const setRepoURL = useCallback((url: string) => {
    setInstructions<InstructionsInfo>(i => {
      i['RepoURL'] = url
    })
  }, [setInstructions])

  const setDescription = useCallback((description: string) => {
    setInstructions<InstructionsInfo>(i => {
      i['Description'] = description
    })
  }, [setInstructions])

  return {
    RepoURL: RepoURL || '',
    Description: Description || '',
    setRepoURL,
    setDescription,
  }
}

export default useInstructions
