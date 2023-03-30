export enum ReferenceType {
  NPMPackage = 'NPM_PACKAGE',
  DEPLOYMENT = 'DEPLOYMENT_SERVICE',
}

export interface Reference {
  type: ReferenceType
  value: string
}
