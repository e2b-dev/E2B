import {
  useMemo,
} from 'react'
import Fuse from 'fuse.js'

import { ReferenceType, Reference } from 'editor/referenceType'
// Top 10k NPM packages
// https://gist.github.com/anvaka/8e8fa57c7ee1350e3491

// const packageReferences: Reference[] = topNPMPackages.map(p => ({
//   type: ReferenceType.NPMPackage,
//   value: p,
// }))


const packageReferences: Reference[] = [
  {
    type: ReferenceType.NPMPackage,
    value: '@slack/web-api',
  }
]

function useReferences(): [Fuse<Reference>, Reference[]] {
  const references = useMemo<Reference[]>(() => [
    // TODO: Package search is synchronous and even with just 10k packages it freezes the whole app.
    ...packageReferences,
  ], [])

  const engine = useMemo(() => new Fuse(references, {
    keys: ['value'],
    threshold: 0.3,
    includeMatches: true,
    useExtendedSearch: true,
  }), [references])

  return [engine, references]
}

export default useReferences
