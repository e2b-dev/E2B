import { ReactNode } from 'react'
import NodeJSExpressTemplate from 'components/Editor/Template/NodeJSExpressTemplate'

export enum ProjectTemplateID {
  NodeJSExpress = 'NodeJSExpress',
}

export interface ProjectTemplate {
  component: ReactNode
}

export const templates: {
  [templateID in keyof typeof ProjectTemplateID]: ProjectTemplate
} = {
  [ProjectTemplateID.NodeJSExpress]: {
    component: <NodeJSExpressTemplate />,
  }
}
