import { deployment_state } from '@prisma/client'
import { ReactNode } from 'react'

import Button from 'components/Button'
import Spinner from 'components/Spinner'

export interface Props {
  deploy: () => void
  deployStatus?: deployment_state | null
  isInitializingDeploy?: boolean
  isDeployRequestRunning?: boolean
}

interface DeploymentRepresentation {
  text: string
  icon: ReactNode | null
}

function getDeploymentRepresentation(deployStatus: deployment_state | null | undefined, isInitializingDeploy: boolean | undefined): DeploymentRepresentation {
  if (isInitializingDeploy) {
    return {
      text: 'Initializing...',
      icon: <Spinner />,
    }
  }

  switch (deployStatus) {
    case deployment_state.generating:
      return {
        text: 'Generating...',
        icon: <Spinner />,
      }
    case deployment_state.deploying:
      return {
        text: 'Deploying...',
        icon: <Spinner />,
      }
    case deployment_state.error:
    case deployment_state.finished:
    default:
      return {
        text: 'Deploy',
        icon: null,
      }
  }
}

function DeployButton({
  deploy,
  deployStatus,
  isDeployRequestRunning,
  isInitializingDeploy,
}: Props) {
  const representation = getDeploymentRepresentation(deployStatus, isInitializingDeploy)

  return (
    <Button
      isDisabled={isDeployRequestRunning}
      text={representation.text}
      onClick={deploy}
      variant={Button.variant.Full}
      icon={representation.icon}
    />
  )
}

export default DeployButton
