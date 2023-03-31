import {
  useMemo,
} from 'react'
import Fuse from 'fuse.js'

import { ReferenceType, Reference } from 'editor/referenceType'

function useReferences(): [Fuse<Reference>, Reference[]] {
  const references = useMemo<Reference[]>(() => [
    {
      type: ReferenceType.NPMPackage,
      value: '@slack/web-api',
    },
    {
      type: ReferenceType.DEPLOYMENT,
      value: 'AWS Lambda',
    },
  ], [])

  const engine = useMemo(() => new Fuse(references, { keys: ['value'], threshold: 0.3 }), [references])

  return [engine, references]
}

export default useReferences
