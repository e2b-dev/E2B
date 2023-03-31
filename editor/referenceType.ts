import Fuse from 'fuse.js'

export enum ReferenceType {
  NPMPackage = 'NPM_PACKAGE',
  DEPLOYMENT = 'DEPLOYMENT_SERVICE',
}

export interface Reference {
  type: ReferenceType
  value: string
}

export type ResultType = Fuse.FuseResult<Reference>
