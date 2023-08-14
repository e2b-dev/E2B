import Tree from 'apps/dashboard/components/FilesystemTree'
export type {
  Props as FilesystemTreeProps,
  FileProps,
  SelectHandler,
} from 'apps/dashboard/components/FilesystemTree'

import DirWrapper from '../apps/dashboard/components/DirWrapper'
export type {
  Props as DirWrapperProps,
  DirProps,
} from '../apps/dashboard/components/DirWrapper'

export { NodeType } from './node'
export type { Metadata } from './node'

export {
  useFilesystem,
  useMetadata,
} from '../hooks/filesystem'

export { default as Node } from './node'
export { default as FileNode } from './file'
export { default as DirNode } from './dir'

/* eslint import/no-anonymous-default-export: [2, {"allowObject": true}] */
export default {
  Tree,
  DirWrapper,
}
