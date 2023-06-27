import { memo } from 'react'

import { projects } from 'db/prisma'

export interface Props {
  project: projects
}

function Deploy({ }: Props) {
  return null
}

export default memo(Deploy)
