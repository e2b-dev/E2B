import Fuse from 'fuse.js'

export enum ReferenceType {
  NPMPackage = 'NPM_PACKAGE',
}

export interface Reference {
  type: ReferenceType
  value: string
}

export type ResultType = Fuse.FuseResult<Reference>
